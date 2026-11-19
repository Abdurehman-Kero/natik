# Pilot hosting: Render (API) + Vercel (website)

A cheap, quick way to put Natik online for a pilot with real people, built so that moving to Natik's own
server later is a copy-and-switch job, not a rebuild. The final layout is in
[`docker/compose.prod.example.yml`](../docker/compose.prod.example.yml); this guide is the stepping stone.

```
 Browser ──► Vercel (website, Next.js) ──/api/*──► Render: API + SMS queue ──► Render PostgreSQL
                                                        │                  └─► Render Key Value (Redis)
                                                        └─► Cloudflare R2 (private files, receipts, certificates)
```

The website forwards `/api/*` to the API, so the browser only ever talks to one address and the sign-in
cookie works without any cross-site settings.

## 0. What you need first

| Need                                                         | Why                                                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The code on GitHub, **committed and pushed**                 | Render and Vercel build from the repository. The remote is already `Abdurehman-Kero/natik`. Everything built recently (email sign-in, profiles, speed work) must be committed first. |
| A Render account                                             | API, database, Redis                                                                                                                                                                 |
| A Vercel account                                             | The website. _Check Vercel's terms:_ the free Hobby plan is for personal, non-commercial use; a pilot for a business normally needs the paid Pro plan.                               |
| A Cloudflare account (R2)                                    | Private file storage (free up to 10 GB). Any S3-compatible storage works.                                                                                                            |
| Optional: an [Afro Message](https://afromessage.com) account | Real SMS. Without it nobody receives password-reset codes or "set your password" links (see section 6).                                                                              |

## 1. File storage (Cloudflare R2), 5 minutes

1. Cloudflare dashboard → **R2** → _Create bucket_ named `natik-private` (keep it **private**; the API serves files after checking who is asking).
2. R2 → _Manage API tokens_ → create a token with **Object Read & Write** on that bucket.
3. Write down: the **S3 endpoint** (`https://<account-id>.r2.cloudflarestorage.com`), the **Access Key ID** and the **Secret Access Key**.

The API does not create the bucket by itself, so it must exist before the first upload.

## 2. The API, database and Redis on Render

1. Render dashboard → **New → Blueprint** → choose the `natik` repository. Render reads [`render.yaml`](../render.yaml) and proposes: `natik-db` (PostgreSQL), `natik-redis` (Redis-compatible Key Value) and `natik-api` (the API, built from `apps/api/Dockerfile`).
2. It asks for the values marked "sync: false":
   - `APP_URL`: the website address. Not known yet: type `https://example.com` and fix it in step 4.
   - `S3_ENDPOINT`, `S3_BUCKET` (`natik-private`), `S3_ACCESS_KEY`, `S3_SECRET_KEY`: from section 1.
3. **Apply.** The first build takes about 10 minutes (it compiles the API and installs a headless browser for certificate PDFs).
4. When it is live, open `https://natik-api-xxxx.onrender.com/api/v1/health` (the exact address is on the service page). You should see `"status":"ok"` with `database` and `redis` both `up`.

Plans: the file picks the smallest _paid_ database and API size, because Render's free tier is built for
trying things out: a free web service goes to sleep after 15 minutes without traffic (the next visitor waits about a minute),
and a free PostgreSQL database is deleted 30 days after creation, with 14 days of grace
([Render: Deploy for Free](https://render.com/docs/free)). The Redis instance is left on `free` (25 MB, not saved to disk), which is
enough for rate limits and the SMS queue.

## 3. Create the tables and the first admin (once)

The API image does not carry the database tools, so this is run from your own computer, once, and again
after any later release that adds tables.

1. On the `natik-db` page copy the **External Database URL**, and add your computer's IP address under _Access Control_ (remove it again afterwards). Add `?sslmode=require` to the end if the URL has none.
2. In PowerShell, from the repository folder:

```powershell
cd apps\api
$env:DATABASE_URL = "<the external database URL>"
$env:APP_ENV = "staging"
$env:SEED_OWNER_NAME = "Natik Owner"
$env:SEED_OWNER_EMAIL = "<the owner's real email>"
$env:SEED_OWNER_PHONE = "+2519XXXXXXXX"
$env:SEED_OWNER_PASSWORD = "<a long password>"
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

3. **Check the line Prisma prints** (`Datasource "db": ... at dpg-....render.com`). If it names `localhost` you are about to change your own development database: stop.
4. The seed adds languages, levels and the owner. It does **not** add the sample teachers, students or courses (those are for `APP_ENV=local` only). The owner signs in with the **email** and password above.

## 4. The website on Vercel

1. Vercel → **Add New → Project** → import the repository.
2. **Root Directory:** `apps/web` (keep "Include source files outside of the Root Directory" on). Framework: Next.js. [`apps/web/vercel.json`](../apps/web/vercel.json) already sets the install and build commands and runs the functions in Frankfurt, next to the API.
3. **Environment variables** (Production and Preview):

| Name                           | Value                                                                                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_INTERNAL_URL`             | The Render API address, e.g. `https://natik-api-xxxx.onrender.com` (no trailing slash). It is read **while building** (the `/api` forwarding is set up then) and while running, so change it only together with a redeploy. |
| `NEXT_PUBLIC_APP_URL`          | The website address, e.g. `https://natik-pilot.vercel.app` (or your own domain)                                                                                                                                             |
| `APP_ENV`                      | `staging` (keeps search engines away from the pilot)                                                                                                                                                                        |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` (makes Vercel use the project's pnpm version)                                                                                                                                                                           |

4. In Project Settings → General set **Node.js Version** to 24.x (the project requires 24 or newer), then **Deploy**.
5. Go back to Render → `natik-api` → Environment and set `APP_URL` to the real website address. Render redeploys by itself.

## 5. Check it works (15 minutes)

1. Open the website, then `/courses`, then register a student with an email, and sign out and in again.
2. Sign in as the owner. Create a language/level if needed, a course, and add a **PDF of about 10 MB** to a lesson.
   - This is the one thing to test on purpose. Vercel limits what its own functions accept to 4.5 MB per request ([Vercel's note on the limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)), and it is not documented whether forwarding to an outside server such as Render is exempt. If the upload fails with "413" or "payload too large", see the fallback below.
3. Student: ask to join the course, pay with a receipt photo; admin: the receipt shows in **Payments**.
4. Admin → **Activity log**: open a few sign-in entries (click the row; the address is in the details). Sign-ins from different phones must show **different visitor addresses**. If every entry shows the same address, set `TRUST_PROXY_HOPS` on the API (Render) to `2` (it is `2` in the file), and if it still repeats, to `3`. This matters because the sign-in and registration limits are counted per address, and one shared address would lock real users out.

**Fallback if big uploads fail on Vercel:** run the website on Render as well. In [`render.yaml`](../render.yaml) un-comment the `natik-web` block, set `TRUST_PROXY_HOPS` to `1`, apply, and use the Render address instead of Vercel (nothing else changes). The cost is one more small Render service.

## 6. What a pilot does and does not have

- **SMS:** `SMS_PROVIDER=console` (the file's default) sends nothing. Registration and sign-in work, but **password reset codes and "set your password" links reach nobody**, so accounts created by an admin cannot be activated. To fix: get an Afro Message token, then on Render set `SMS_PROVIDER=afromessage` and `AFROMESSAGE_TOKEN` (and `AFROMESSAGE_IDENTIFIER_ID` if you have one).
- **Videos:** `VIDEO_PROVIDER=local` keeps lesson videos in the bucket (up to 100 MB each, played through the API). Production uses Bunny Stream: create a library, enable token authentication and set `VIDEO_PROVIDER=bunny` with `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `BUNNY_TOKEN_KEY`.
- **`APP_ENV=staging`:** the API's own interactive documentation stays on at `/api/docs` and the stricter response headers of production are off. Do not put real money flows or sensitive data on it until you switch to `production` (which also requires real SMS and Bunny).
- **Backups:** a paid Render PostgreSQL keeps daily backups; R2 keeps the files. Run the nightly off-site copy from [`RUNBOOKS.md`](RUNBOOKS.md) before real students depend on it.
- **Direct access to the API address:** the API address on Render is public. That is normal, but it means someone could call it directly instead of through the website. Nothing is exposed that the website does not expose; only the per-address rate limits are easier to get around.

## 7. Moving to Natik's own server later

Nothing in the code is tied to Render or Vercel; all settings are environment variables.

1. Build the three images from the same Dockerfiles ([`apps/api/Dockerfile`](../apps/api/Dockerfile), [`apps/web/Dockerfile`](../apps/web/Dockerfile)) and start them with [`docker/compose.prod.example.yml`](../docker/compose.prod.example.yml) (Caddy in front, `TRUST_PROXY_HOPS=1`).
2. **Database:** `pg_dump` the Render database (External URL) and restore it on the new PostgreSQL. Then run `prisma migrate deploy` with the migrate image.
3. **Files:** copy the bucket (`rclone sync` from R2 to the new S3-compatible storage), keep the same bucket name, and put the new endpoint and keys in the API's environment. File records in the database do not change.
4. Copy the environment values across (the same `OTP_PEPPER`, so stored code hashes stay valid), point the domain's DNS at the new server, and keep the Vercel/Render copy for a few days as a fallback.

## 8. When something goes wrong

| Symptom                                       | Likely cause                                                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website shows an error page, health URL fails | The API is still starting (Render free sizes sleep), or an environment value is missing: read the API's logs on Render, the first lines say which. |
| Every API call from the website fails         | `API_INTERNAL_URL` on Vercel is wrong or was changed without redeploying.                                                                          |
| "Too many attempts" for many people at once   | All visitors share one address: see step 4 of section 5.                                                                                           |
| Uploads fail, other things work               | The bucket does not exist or the R2 token is read-only; or the Vercel size limit (section 5).                                                      |
| Certificates do not print                     | The API ran out of memory while starting the headless browser: move `natik-api` up one size.                                                       |
| `prisma migrate deploy` cannot connect        | Your IP is not in the database's Access Control, or the URL lacks `?sslmode=require`.                                                              |
