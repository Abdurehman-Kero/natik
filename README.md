# Natik Language Centre

Website and online learning platform for Natik Language Centre (Arabic · English · Afaan Oromo).
Built from SRS NLC-SRS-003 v3.0 (MVP). The delivery plan and milestone status live in [`plan/`](plan/README.md).

## Quick start

Requirements: **Node.js 24**, **pnpm 11** (`corepack enable`), **Docker Desktop**.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm services:up      # PostgreSQL, Redis, file storage, Mailpit
pnpm db:migrate       # create tables
pnpm db:seed          # languages, levels, Owner admin (+ dev teacher/student)
pnpm dev              # web + API (+ worker) with hot reload
```

| What                       | Where                                            |
| -------------------------- | ------------------------------------------------ |
| Website                    | http://localhost:3000                            |
| Styleguide (design system) | http://localhost:3000/styleguide                 |
| API                        | http://localhost:4000/api/v1                     |
| API docs (OpenAPI)         | http://localhost:4000/api/docs                   |
| Health check               | http://localhost:4000/api/v1/health              |
| File storage console       | http://localhost:9011 (natik / natik-dev-secret) |
| Email inbox (Mailpit)      | http://localhost:8026                            |

Development accounts (local seed only; passwords never used elsewhere):

| Role        | Phone                                           | Password                   |
| ----------- | ----------------------------------------------- | -------------------------- |
| Owner admin | from `SEED_OWNER_PHONE` (default +251911000000) | from `SEED_OWNER_PASSWORD` |
| Teacher     | +251911000001                                   | Teacher2026                |
| Student     | +251911000002                                   | Student2026                |

## Sending real SMS

By default (`SMS_PROVIDER=console`) nothing is texted; codes appear at `/dev/sms`. To send real messages through
[Afro Message](https://afromessage.com), put these in `apps/api/.env` and restart `pnpm dev`:

```
SMS_PROVIDER=afromessage
AFROMESSAGE_TOKEN=<API token from the Afro Message dashboard>
AFROMESSAGE_IDENTIFIER_ID=<only if your account has several identifiers>
SMS_SENDER=<a sender name approved on your account>
```

Production refuses to start with `SMS_PROVIDER=console`. Failed messages are retried after 1, 5 and 15 minutes.

## Repository layout

```
apps/web         Next.js website and learning app (App Router, Tailwind)
apps/api         NestJS JSON API + background worker, Prisma schema and migrations
packages/shared  Code shared by web and API: enums, formatters, error codes
packages/config  Shared TypeScript and ESLint presets
docker/          Local services (compose.dev.yml) and an example production layout
plan/            Implementation plan, architecture and design system
```

## Common commands

| Command                        | Does                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `pnpm dev`                     | Start services, then web, API and worker in watch mode                           |
| `pnpm dev:warm`                | `pnpm dev` already does this for you; run it again to re-warm every page         |
| `pnpm preview`                 | Build, then run the production versions (the real speed of the site)             |
| `pnpm lint` · `pnpm typecheck` | Static checks for every package                                                  |
| `pnpm test`                    | Unit tests (no services needed)                                                  |
| `pnpm test:int`                | API integration tests (needs `pnpm services:up`; uses the `natik_test` database) |
| `pnpm e2e`                     | Browser tests with accessibility scan (run `pnpm build` first)                   |
| `pnpm format`                  | Format all files with Prettier                                                   |
| `pnpm db:studio`               | Browse the database                                                              |
| `pnpm services:down`           | Stop local services (data is kept in Docker volumes)                             |

## Conventions

- **UI:** follow [`plan/DESIGN.md`](plan/DESIGN.md): one primary action per page, short text, four states (loading, empty, error, success). Every component is in the styleguide.
- **Text:** all interface strings live in `apps/web/messages/en.json`.
- **API errors:** always `{ error: { code, message, fields?, params?, requestId } }`. Codes are in `packages/shared/src/errors.ts`.
- **Money** is integer santim; **dates** are UTC in the database and shown in East Africa Time.
- **Secrets** come only from environment variables. `.env` files are never committed.

## Handover documents

| Document                                                                                        | What it is                                                                      |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md)                                                          | Deploy, roll back, backup and restore, rotate secrets, add an admin, failed SMS |
| [`docs/ADMIN-GUIDE.md`](docs/ADMIN-GUIDE.md) · [`docs/TEACHER-GUIDE.md`](docs/TEACHER-GUIDE.md) | One task per section, for staff                                                 |
| [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md)                                                  | Which tests prove each acceptance test (AT-01…16)                               |
| [`docs/openapi.json`](docs/openapi.json)                                                        | The API description (also at `/api/docs` when running locally)                  |

## Docker images

```bash
docker build -f apps/web/Dockerfile -t natik-web .
docker build -f apps/api/Dockerfile -t natik-api .                      # API; worker = node dist/worker.js
docker build -f apps/api/Dockerfile --target migrate -t natik-migrate .  # prisma migrate deploy
```

See `docker/compose.prod.example.yml` for how they fit together behind one domain.
