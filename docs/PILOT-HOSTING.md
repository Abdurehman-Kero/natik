# Free pilot hosting: Render (API) + Vercel (website)

A free way to put Natik online for a pilot, built so that moving to Natik's own server later is a
copy-and-switch job, not a rebuild. The final layout is in
[`docker/compose.prod.example.yml`](../docker/compose.prod.example.yml); this guide is the stepping stone.

```
 Browser ──► Vercel (website, Next.js) ──/api/*──► Render: API + SMS queue ──► Render PostgreSQL (free)
                                                        │                  └─► Render Key Value / Redis (free)
                                                        └─► files kept inside that same PostgreSQL (free pilot)
```

The website forwards `/api/*` to the API, so the browser only ever talks to one address and the sign-in
cookie works without any cross-site settings.

## What "free" means here (read this first)

| Part              | Free limit                                                                                                                                                           | What it means for the pilot                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Render API        | Sleeps after 15 minutes without traffic, about a minute to wake ([Render: Deploy for Free](https://render.com/docs/free)). 750 free hours a month, 512 MB of memory. | The first visitor after a quiet spell waits. Fix: a free pinger keeps it awake (section 5, step 3). Printing certificates may run out of memory. |
| Render PostgreSQL | 1 GB, **deleted 30 days after creation** (14 days of grace), no backups.                                                                                             | Fine for a pilot of a few weeks. Put the date in your calendar and follow section 6 before it.                                                   |
| Render Redis      | In memory only, lost on a restart.                                                                                                                                   | Only rate-limit counters and queued SMS messages are lost; accounts and courses are safe.                                                        |
| Render builds     | A limited number of build minutes a month.                                                                                                                           | A new version is deployed by hand (not on every push).                                                                                           |
| Vercel            | The free "Hobby" plan is for personal, **non-commercial** use.                                                                                                       | A pilot for the centre may need the paid Pro plan: read Vercel's terms and decide.                                                               |
| Files             | Kept inside the free Render database (1 GB, shared with everything else).                                                                                            | No storage account and no card. They disappear with the database after 30 days, so back up with `pg_dump` (section 6). Keep videos short.        |

## 0. What you need

- The code on GitHub, committed and pushed (the repository is `Abdurehman-Kero/natik`; keep `main` up to date).
- Accounts, free to open: [Render](https://render.com), [Vercel](https://vercel.com) (sign in to both with GitHub, it is simplest) and a pinger such as [UptimeRobot](https://uptimerobot.com). None of the free plans should ask for a payment card; if one does, stop there and tell me.
- Optional now, needed before real students: an [Afro Message](https://afromessage.com) account for SMS (section 7).
- On your computer: the project already running locally (`pnpm install` done), and PowerShell.

## 1. File storage: nothing to set up

Receipts, certificates, lesson files and pictures are kept **inside the free database** (`STORAGE_DRIVER=database`,
already set in [`render.yaml`](../render.yaml)). That is why the pilot needs no storage account and no card. The cost:
they share the free database's 1 GB and they go when the database does, so they are covered by the same `pg_dump`
backup (section 6). A few hundred receipts and PDFs fit easily; long videos do not (section 7).

## 2. The API, database and Redis on Render, about 15 minutes

1. Render → **Account Settings** → connect **GitHub** and allow the `natik` repository.
2. **New → Blueprint** → choose the `natik` repository and branch `main`. Render reads [`render.yaml`](../render.yaml) and lists three things: `natik-db` (PostgreSQL), `natik-redis` (Redis) and `natik-api` (the API). All three are on the `free` plan.
3. It asks for one value marked "enter once": `APP_URL`. Type `https://example.com` for now (fixed in section 5, step 1).
4. **Deploy Blueprint.** The first build takes about 10 to 15 minutes (it compiles the API and installs a headless browser for certificate PDFs).
5. If the dashboard rejects a value in the file (for example the Redis memory setting on the free plan), remove that line or pick the option it offers, commit, and try again.
6. Open the `natik-api` page and copy its address (`https://natik-api-xxxx.onrender.com`). Open `<that address>/api/v1/health`: you should see `"status":"ok"` with `database` and `redis` both `up`. The first request after a sleep can take a minute.
7. Write down today's date: the free database lasts 30 days (section 6).

## 3. Create the tables and the first admin (once, from your computer)

The API image does not carry the database tools, so this is run from your own computer, once, and again
after any later version that adds tables.

1. Render → `natik-db` → **Connections**: copy the **External Database URL**.
2. On the same page, under **Access Control**, add your computer's public IP address (search "what is my IP"). Remove it again afterwards.
3. In PowerShell, from the project folder:

```powershell
cd apps\api
$env:DATABASE_URL = "<the external database URL>?sslmode=require"
$env:APP_ENV = "staging"
$env:SEED_OWNER_NAME = "Natik Owner"
$env:SEED_OWNER_EMAIL = "<the owner's real email>"
$env:SEED_OWNER_PHONE = "+2519XXXXXXXX"
$env:SEED_OWNER_PASSWORD = "<a long password>"
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

4. **Check the line Prisma prints** (`Datasource "db": ... at dpg-....render.com`). If it names `localhost` you are about to change your own development database: stop.
5. The seed adds languages, levels, the level-check questions and the owner. It does **not** add the sample teachers, students or courses (those are for development only). The owner signs in with the **email** and password above.

## 4. The website on Vercel, about 10 minutes

1. Vercel → **Add New → Project** → import `natik` (allow GitHub access to the private repository).
2. On the configure screen:
   - **Project Name**: for example `natik-pilot`. The website address will be `https://natik-pilot.vercel.app` (Vercel adds a suffix if the name is taken; check the address after the first deploy).
   - **Root Directory**: click _Edit_ and choose `apps/web`. Leave "Include source files outside of the Root Directory" on.
   - Framework: Next.js. The install and build commands come from [`apps/web/vercel.json`](../apps/web/vercel.json) (it also runs the website's server code in Frankfurt, next to the API).
3. Open **Environment Variables** and add these **before** the first deploy:

| Name                           | Value                                                                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_INTERNAL_URL`             | The Render API address from section 2, step 6, no trailing slash. It is read **while building** (the `/api` forwarding is set up then) and while running, so change it only together with a redeploy. |
| `NEXT_PUBLIC_APP_URL`          | The website address, e.g. `https://natik-pilot.vercel.app`                                                                                                                                            |
| `APP_ENV`                      | `staging` (keeps search engines away from the pilot)                                                                                                                                                  |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` (makes Vercel use the project's pnpm version)                                                                                                                                                     |

4. Click **Deploy**. After it finishes, open **Settings → General → Node.js Version** and choose the highest version offered that is 24 or newer (the project needs 24+), then redeploy if you changed it.
5. Compare the real address with `NEXT_PUBLIC_APP_URL`. If they differ, edit the variable and redeploy.

## 5. Connect the two, then check it works

1. Render → `natik-api` → **Environment** → set `APP_URL` to the real website address → **Save**. Render restarts the API.
2. Open the website. The home page loads, `/courses` shows an empty list (no courses yet), and sign-in with the owner's email works.
3. **Keep the API awake.** In UptimeRobot add an **HTTP(s)** monitor for `https://natik-api-xxxx.onrender.com/api/v1/health` every 5 minutes. Without it, the website shows an error to whoever arrives first after 15 quiet minutes, because the API is still waking up. One always-awake API uses almost all of Render's 750 free hours, which is fine for one service but not two.
4. Create a course and add a **PDF of about 10 MB** to a lesson. This is the one thing to test on purpose: Vercel limits what its own functions accept to 4.5 MB per request ([Vercel's note on the limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)), and it is not documented whether forwarding to an outside server such as Render is exempt. If the upload fails with "413" or "payload too large", see the fallback below.
5. Register a student, ask to join the course, pay with a receipt photo; as admin the receipt shows in **Payments**.
6. Admin → **Activity log**: open a few sign-in entries (click the row; the address is in the details). Sign-ins from different phones must show **different visitor addresses**. If every entry shows the same address, set `TRUST_PROXY_HOPS` on the API to `3` (it is `2` in the file). This matters because the sign-in and registration limits are counted per address, and one shared address would lock real users out.

**Fallback if big uploads fail on Vercel:** run the website on Render as well. In [`render.yaml`](../render.yaml) un-comment the `natik-web` block (set `API_INTERNAL_URL` to the API's public address), set `TRUST_PROXY_HOPS` to `1`, commit, and apply the Blueprint again. Two always-awake free services use more than the free 750 hours a month, so let the website sleep (no pinger for it) or upgrade one of them.

## 6. Before day 30: the free database expires

On day 30 the database becomes unreachable, and it is deleted 14 days later ([Render: Deploy for Free](https://render.com/docs/free)). Choose one a few days before:

- **Keep Render, pay:** `natik-db` → change the plan to a paid size. This keeps the data and the address.
- **Move to another free PostgreSQL** (for example Neon or Supabase; check their current free limits): create a database there, then copy the data:
  1. `pg_dump "<old external URL>" --no-owner --format=custom --file natik.dump` (needs the PostgreSQL command-line tools; they come with a PostgreSQL install).
  2. `pg_restore --no-owner --dbname "<new URL>" natik.dump`
  3. On Render → `natik-api` → **Environment** replace `DATABASE_URL` with the new address (the "link to database" value is replaced by plain text), save.
- **Go to the real server** (section 9).

Always take the dump first, even if you intend to pay: the free database has no backups.

## 7a. Turn on email (free), about 10 minutes

When an admin adds a student, teacher or admin, the person gets **an email** with their sign-in email, what to do first and a
**link to choose their password** (the link works once and expires in 3 days; the password itself is never emailed). The same
email service sends the 6-digit code of "Forgot password". Until you set this up, nothing is emailed and the admin sees the link
on screen after adding someone, with a **Copy link** button, to pass on by WhatsApp or Telegram.

Render's free web services block the usual mail ports 25, 465 and 587 ([Render: Deploy for Free](https://render.com/docs/free)),
so use a mail service that also accepts **port 2525**. [Brevo](https://www.brevo.com) does, and its free plan allows 300 emails a
day without a card ([Brevo: free SMTP server](https://www.brevo.com/free-smtp-server)). Check its current limits when you sign up.

1. Create a free Brevo account.
2. **Verify a sender:** Brevo → _Senders, domains & dedicated IPs_ → _Senders_ → add the email address the messages come from (the
   owner's email is fine for a pilot) and confirm it from the email Brevo sends. Brevo may also need a short time to approve a new
   account for sending.
   If that address is a Gmail or Yahoo address, Brevo cannot authenticate it: it replaces the sending domain with its own, so the
   email may show a Brevo address and is more likely to land in spam ([Brevo: domain authentication](https://help.brevo.com/hc/en-us/articles/16045394674066)).
   That is acceptable for a pilot. Once Natik has its own domain, verify the domain in Brevo and use an address on it.
3. **Get the SMTP login:** Brevo → _SMTP & API_ → _SMTP_. Copy the **login** (looks like `something@smtp-brevo.com`) and create an
   **SMTP key**. The key is the password; it is shown once.
4. On Render → `natik-api` → **Environment**, add these values (a Blueprint does not create them for you):

| Name             | Value                                               |
| ---------------- | --------------------------------------------------- |
| `EMAIL_PROVIDER` | `smtp`                                              |
| `SMTP_HOST`      | `smtp-relay.brevo.com`                              |
| `SMTP_PORT`      | `2525`                                              |
| `SMTP_USER`      | the SMTP login from step 3                          |
| `SMTP_PASSWORD`  | the SMTP key from step 3                            |
| `EMAIL_FROM`     | `Natik <the sender address you verified in step 2>` |

5. Save (Render restarts the API). Then in the website: **Admin → Users → New user**, add a test person with an email you can
   read. The message should arrive within a minute: **check the spam folder** the first time. Messages sent "from" a Gmail address
   through another service are often marked as spam; an address on your own domain is better once you have one.
6. If the screen shows the link instead of "emailed", the message was not sent: read the API's **Logs** on Render. The line starts
   with `Email to ...` and says why (wrong key, sender not verified, port blocked).

On your own computer you can read these emails in the local Mailpit inbox (<http://localhost:8026>): in `apps/api/.env` set
`EMAIL_PROVIDER=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1026` and `EMAIL_FROM=Natik <natik@localhost>`.

## 7b. Turn on "Continue with Google" (free, optional)

Lets people sign up and sign in with a Google account. It needs a free Google Cloud "OAuth client" and two settings on the API
(`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). Follow [GOOGLE-SIGN-IN.md](GOOGLE-SIGN-IN.md); the redirect address to give Google is
`https://<your website>/api/v1/auth/google/callback`. Without it the button just does not show.

## 7. What a pilot does and does not have

- **SMS:** not needed for the pilot. `SMS_PROVIDER=console` (the default) sends nothing; people get their password links and reset codes by **email** instead (section 7a). If email is not set up, the admin is shown the link on screen to pass on by hand. Add an Afro Message token later (`SMS_PROVIDER=afromessage` and `AFROMESSAGE_TOKEN`) if you want texts too; they are then used when an email cannot be sent.
- **Videos:** `VIDEO_PROVIDER=local` keeps lesson videos in the same file storage (up to 100 MB each, played through the API). In this pilot that means inside the 1 GB database, so keep them short or use few. Production uses Bunny Stream: create a library, enable token authentication and set `VIDEO_PROVIDER=bunny` with `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `BUNNY_TOKEN_KEY`.
- **`APP_ENV=staging`:** the API's own interactive documentation stays on at `/api/docs` and the stricter response headers of production are off. Do not put real money flows or sensitive data on it until you switch to `production` (which also requires real SMS and Bunny).
- **Backups:** the free Render database has none, and it now holds the files too. Take a `pg_dump` (section 6) every few days. Run the nightly off-site copy from [`RUNBOOKS.md`](RUNBOOKS.md) before real students depend on it.
- **Deploying a new version:** the API is deployed by hand: Render → `natik-api` → **Manual Deploy → Deploy latest commit** (and run `prisma migrate deploy` from section 3 if the version adds tables). Vercel deploys the website by itself on every push to `main`.
- **Direct access to the API address:** the API address on Render is public. That is normal, but it means someone could call it directly instead of through the website. Nothing is exposed that the website does not expose; only the per-address rate limits are easier to get around.

## 8. When something goes wrong

| Symptom                                       | Likely cause                                                                                                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website shows an error page, health URL fails | The API is asleep or still starting (wait a minute, then set up the pinger from section 5, step 3), or an environment value is missing: read the API's **Logs** on Render, the first lines say which. |
| Build on Render fails                         | Open the build log. Often a plan or field name Render does not accept in `render.yaml`, or the build ran out of free build minutes.                                                                   |
| Every API call from the website fails         | `API_INTERNAL_URL` on Vercel is wrong or was changed without redeploying.                                                                                                                             |
| "Too many attempts" for many people at once   | All visitors share one address: see section 5, step 6.                                                                                                                                                |
| Uploads fail, other things work               | The Vercel size limit (section 5, step 4), or the free database is full (1 GB): remove old files or move to a bigger database.                                                                        |
| Certificates do not print                     | The free API (512 MB) ran out of memory starting the headless browser: pay for a bigger size, or issue them later from the real server.                                                               |
| `prisma migrate deploy` cannot connect        | Your IP is not in the database's Access Control, or the URL lacks `?sslmode=require`.                                                                                                                 |
| Sign-in works locally but not online          | The website address in `APP_URL` (Render) or `NEXT_PUBLIC_APP_URL` (Vercel) does not match the real address.                                                                                          |

## 9. Moving to Natik's own server later

Nothing in the code is tied to Render or Vercel; all settings are environment variables.

1. Build the three images from the same Dockerfiles ([`apps/api/Dockerfile`](../apps/api/Dockerfile), [`apps/web/Dockerfile`](../apps/web/Dockerfile)) and start them with [`docker/compose.prod.example.yml`](../docker/compose.prod.example.yml) (Caddy in front, `TRUST_PROXY_HOPS=1`).
2. **Database:** `pg_dump` the Render database (External URL) and restore it on the new PostgreSQL. Then run `prisma migrate deploy` with the migrate image.
3. **Files:** create an S3-compatible bucket and its keys, set `DATABASE_URL` and the `S3_*` values in your shell, and run `cd apps/api && pnpm exec tsx prisma/copy-files-to-s3.ts` (see the comment at the top of that file). It copies every file out of the database with the same names and can be run again safely. Then set `STORAGE_DRIVER=s3` and the same `S3_*` values on the API. File records in the database do not change.
4. Copy the environment values across (the same `OTP_PEPPER`, so stored code hashes stay valid), point the domain's DNS at the new server, and keep the Render and Vercel copy for a few days as a fallback.
