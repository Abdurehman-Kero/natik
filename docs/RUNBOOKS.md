# Runbooks

Short, step-by-step. Replace names in `<angle brackets>`. The layout of the servers is in
[`docker/compose.prod.example.yml`](../docker/compose.prod.example.yml).

## 1. Deploy a new version

1. Check that CI is green on the commit (lint, types, API tests, browser tests, speed budgets, images build).
2. Build and push the three images: web, API (also runs the worker), migrate.
3. **Back up first** (runbook 3, "Back up now").
4. Run the migrate image once: `prisma migrate deploy`. It only adds what is new.
5. Start the new API and worker, then the new web image. The API reports `GET /api/v1/health` = `ok`.
6. Smoke test (below). If anything fails, roll back (runbook 2).

**Smoke test (5 minutes):** open the home page and a course page · register a test student · enrol in the free
course and open its lesson · as admin open Payments · verify a known certificate number on `/verify`.

## 2. Roll back

1. Start the previous web and API images again (keep the last two versions tagged).
2. Database changes only ever add things, so the old version keeps working with the new tables. If a
   migration itself was wrong, restore the backup taken in step 3 of the deploy (runbook 3, "Restore").
3. Confirm `/api/v1/health` and run the smoke test.

## 3. Backups and restore

**What is backed up:** the PostgreSQL database and the file storage bucket (lesson files, receipts, certificates).
Nightly, off-site, kept 30 days. Managed Postgres also keeps point-in-time recovery.

**Back up now**

```bash
pg_dump --format=custom --file=natik-$(date +%F).dump "$DATABASE_URL"
# copy the storage bucket to the backup provider (rclone/s3 sync), then copy the dump next to it
```

**Restore (also the monthly drill)**

1. Create an empty PostgreSQL database and storage bucket (a fresh environment, never the live one for a drill).
2. `pg_restore --clean --if-exists --no-owner --dbname="$NEW_DATABASE_URL" natik-<date>.dump`
3. Sync the backed-up files into the new bucket.
4. Start the API against the new database. Check: sign in as the owner, open a lesson with a PDF, open a
   certificate PDF, count students (Admin › Dashboard). **Write down how long it took.**

## 4. Rotate a secret

Secrets are environment variables only. To rotate one (database password, S3 keys, SMS token, video key):
create the new value at the provider, update the variable in the hosting dashboard, restart API and worker,
check `/api/v1/health`, then delete the old value at the provider. The session secret rotates by changing
`SESSION_SECRET`; everyone is signed out once.

## 5. Add an admin

Only the **Owner** can. Admin › Users › New user › role Admin. The person gets a text message with a link to
set their password. To make someone an Owner, edit the user and tick "Owner". There must always be at
least one Owner; the app refuses to remove the last one.

## 6. A text message failed

Admin › Settings › **SMS delivery** lists failed messages with the error. Press **Retry**. If many fail, check
the SMS gateway account (credit, sender name approved) and the `AFROMESSAGE_*` variables, then retry them.
Messages are retried automatically after 1, 5 and 15 minutes before they show up here.

## 7. A student says "I paid but can't open the course"

Admin › Payments to check. Find the student (the list is oldest first). Confirm or reject with a reason. If they
paid cash, use **Record cash payment**. Access opens the moment a payment is confirmed.

## 8. A student asks to delete their data

Admin › Users › their row › ⋯ › **Delete personal data**. Give the reason ("Requested by the student"). It
cannot be undone. Do this within 30 days of the request (SRS §8.2).

## 9. Certificates will not print

Certificates are printed by a headless Chromium inside the worker. If downloads say "being prepared": check
the worker is running and `CHROMIUM_PATH` points to the browser. Students can retry; the PDF is created on
the next request.

## 10. The site is slow or down

1. `GET /api/v1/health` shows database and Redis status.
2. Check the uptime monitor and Sentry for new errors.
3. Redis down: sign-ins and background jobs stop; restart Redis, then the worker.
4. Database slow: look for long-running queries and check disk space; scale the database tier up if needed.
