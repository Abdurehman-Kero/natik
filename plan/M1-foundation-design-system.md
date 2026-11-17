# M1: Foundation & Design System

|                |                           |
| -------------- | ------------------------- |
| **Status**     | ✅ Done (approved)        |
| **Depends on** | Nothing (first milestone) |
| **Unlocks**    | M2                        |
| **Size**       | Medium                    |

## Goal

A running, deployable skeleton with Natik's design system and an empty shell for every area. Later milestones only need to plug features in.

## Scope

**In:** monorepo, tooling, local services, the full database schema, API and web skeletons, brand tokens and fonts, the component library, layout shells, error pages, styleguide, CI, Dockerfiles.
**Out:** feature logic (sign-in, courses and so on). Shells show placeholder navigation only.

## SRS covered

FR-UI-001…004 · NFR-USE-002 (component level) · NFR-MAINT-001, 002, 003 · NFR-SEC-006 · NFR-REL-003 (error logging) · §10 messages (in the translation file)

---

## Screens

| Screen        | Purpose                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/styleguide` | Every component in every state. Disabled in production. This is what Natik reviews and approves (FR-UI-005)            |
| Public shell  | Header + footer from DESIGN.md §8                                                                                      |
| Account shell | Centered card on off-white, with the compact logo above it (the full lockup is unreadable at this size, DESIGN.md §16) |
| Student shell | Top bar + 4 bottom tabs (mobile), sidebar (desktop)                                                                    |
| Staff shell   | Collapsible sidebar, drawer on mobile, page header with one action slot                                                |
| 404 / 500     | Friendly page with links to Home and Contact (§10)                                                                     |

```
Styleguide (desktop)
┌──────────────┬────────────────────────────────────────────────┐
│ Colours      │  Buttons                                       │
│ Type         │  [Primary] [Secondary] [Ghost] [Danger] [ ⟳ ]  │
│ Buttons      │                                                │
│ Inputs       │  Status pills                                  │
│ Pills        │  (Active) (Completed) (Payment under review) …  │
│ Cards        │                                                │
│ Feedback     │  Course card · Stat card · Empty state         │
│ Overlays     │  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│ Media        │  │  image   │ │  1,248   │ │   (icon)     │    │
│ Layouts      │  │ Title    │ │ Students │ │ No courses   │    │
│              │  │ AR · Beg │ └──────────┘ │ [Browse]     │    │
│              │  └──────────┘              └──────────────┘    │
└──────────────┴────────────────────────────────────────────────┘
```

```
404 (mobile)
┌─────────────────────────────┐
│ [logo]                  ☰   │
├─────────────────────────────┤
│                             │
│         (compass icon)      │
│     Page not found          │
│  Let's get you back on track│
│                             │
│   [ Go home ]  [ Contact ]  │
│                             │
└─────────────────────────────┘
```

---

## Tasks

### 1. Repository and tooling

- [x] `git init`, `.gitignore`, `.editorconfig`, `.nvmrc` (Node 24 LTS), and a README with quick start
- [x] pnpm workspace + Turborepo: `apps/web`, `apps/api`, `packages/shared`, `packages/config`
- [x] Strict TypeScript, ESLint, Prettier (with Tailwind class sorting), Husky + lint-staged (format on commit; ESLint runs in CI)
- [x] `docker/compose.dev.yml`: PostgreSQL 17 (+ `natik_test` database), Redis 7, RustFS S3 storage (+ private bucket created on start), Mailpit
- [x] `.env.example` for each app. Config is validated with zod at boot and fails fast with a clear message
- [x] One command, `pnpm dev`, starts the services, web (:3000), API (:4000) and worker

### 2. Shared package

- [x] Enums and status types from ARCHITECTURE §5 (a test keeps them identical to Prisma's)
- [x] `formatMoney(santim)` → `ETB 1,500` / `Free`, and `formatDate` (EAT), with unit tests
- [x] The error code catalogue (`PAYMENT_REFERENCE_DUPLICATE`, …), which maps to message keys

### 3. API skeleton

- [x] NestJS app with one (empty) module folder per ARCHITECTURE §4 (14 modules)
- [x] **Prisma: the full MVP schema** (ARCHITECTURE §5, 33 tables) and the initial migration
- [x] Partial unique indexes (enrolment, payment reference, final quiz) and the trigger that blocks UPDATE/DELETE/TRUNCATE on `AuditLog`
- [x] Seed: "Main Centre" branch, languages (Arabic `ar` RTL, English `en`, Afaan Oromo `om`), levels (Beginner, Intermediate, Advanced), Owner admin from env. Dev only: one teacher and one student. Safe to re-run
- [x] Global pieces: zod validation pipe, error filter (standard error shape), request ID, pino logger (redacts phone, password, code, token), helmet, `/api/v1/health` (database + Redis)
- [x] Swagger at `/api/docs` (not in production)
- [x] Sentry (DSN from env, off locally)
- [x] `worker.ts` entry with BullMQ connected and the six queues registered

### 4. Web skeleton

- [x] Next.js App Router + Tailwind v4. **Brand tokens** from DESIGN.md §2 in `@theme`
- [x] Fonts via `next/font`: Montserrat + Inter. Noto Naskh Arabic + Noto Sans Ethiopic are set up but load only when used
- [x] `next-intl` with `messages/en.json` (type-checked keys), including every SRS §10 error message
- [x] API client: server-side `apiFetch` (forwards cookies) and client-side `api()` + TanStack Query provider. `/api/*` rewrite to the API
- [x] Logo: transparent versions made from `plan/assets/natik-logo.png` (full lockup + mark), favicon, app icons and the Open Graph image
- [x] Layout shells: `PublicShell`, `AccountShell`, `StudentShell`, `StaffShell` (teacher and admin nav per DESIGN.md §8)
- [x] `not-found.tsx`, `error.tsx` and `global-error.tsx` (friendly, Home + Contact)

### 5. Component library (`components/ui`)

Built on Radix primitives and styled with brand tokens. Every component is keyboard-accessible.

- [x] Actions: `Button` (all variants + loading), `IconButton`, `LinkButton`
- [x] Inputs: `TextField`, `PhoneField`, `PasswordField`, `OtpField`, `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioCards`, `DateField`, `MoneyField`, `FileDrop`, `SearchField`
- [x] Form: `FormField` (label, hint, error), `FormActions`
- [x] Display: `Card`, `CourseCard`, `StatCard`, `StatusPill` (full mapping from DESIGN.md §7), `Badge`, `Avatar`, `ProgressBar`, `ProgressRing`, `EmptyState`, `Skeleton`, `DataTable` (card mode under 768 px), `KeyValue`, `Timeline`
- [x] Navigation: `PublicHeader`, `Footer`, `Sidebar`, `BottomTabs`, `Breadcrumb`, `Tabs`, `Pagination`, `Stepper`
- [x] Overlay: `Dialog`, `ConfirmDialog` (with optional required reason), `Sheet`, `DropdownMenu`, `Tooltip`, `Toast`
- [x] Layout: `PageHeader`, `SectionHeading` (gold bar), `Container`, `StickyActionBar`
- [x] `/styleguide` page with every component and its states. Returns 404 when `APP_ENV=production`

### 6. CI/CD and delivery

- [x] GitHub Actions: format → lint → typecheck → unit tests → build, plus integration tests (Postgres + Redis services), browser tests, and Docker image builds on `main`
- [x] Playwright + axe smoke tests at 320 px, 393 px (Pixel 5), 768 px and 1280 px
- [x] Multi-stage Dockerfiles: `web`, and `api` (also the worker, plus a `migrate` target). Example production compose + Caddy reverse proxy. Both images built and smoke-tested locally (non-root user, health OK, docs hidden in production, styleguide only outside production)
- [x] Lighthouse CI config with the DESIGN.md §15 budgets (it starts enforcing in M4)

---

## Implementation notes (decisions made while building)

| Topic                    | What changed and why                                                                                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versions                 | Newest stable release of each major that the tooling supports: Next.js 16.4, React 19.3, NestJS 11.2 (`nestjs-zod` doesn't support Nest 12 yet), Prisma 7.10, TypeScript 5.9 (TypeScript 7 is too new for the linters), Tailwind 4.3, zod 4.6                   |
| Local file storage       | **RustFS** instead of MinIO: MinIO stopped publishing community Docker images. It speaks the same S3 API, so nothing changes in the code                                                                                                                        |
| Partial indexes          | Declared in the Prisma schema (`partialIndexes` preview) rather than hand-written SQL, so future migrations never try to drop them. Only the audit-log trigger is raw SQL                                                                                       |
| Integration tests        | Run against a separate `natik_test` database, never the development data                                                                                                                                                                                        |
| Worker in development    | Runs inside the API process (`RUN_WORKER_IN_API=true`) so `pnpm dev` is one command. Staging/production run `node dist/worker.js` separately                                                                                                                    |
| Colours                  | Two tokens darkened to pass WCAG AA: `accent-strong` `#7A6428` (was `#8A7232`, only 4.0:1 on the gold pill) and `success` `#276B43`. Input borders use `border-strong` (3.2:1). Gold buttons use dark ink text (5.4:1); navy on gold is only 4.3:1              |
| Logo                     | The full stacked lockup is unreadable below about 240 px tall, so headers, footer and sign-in use the compact logo (mark + "NATIK" as live text). The hero shows the real calligraphy mark as a faint watermark                                                 |
| Social icons             | lucide 1.x removed brand icons, so social links are clean text chips                                                                                                                                                                                            |
| Found by the 320 px test | The 6 SMS-code boxes overflowed small phones inside the sign-in card. They now share the row's width (max 48 px each)                                                                                                                                           |
| Docker images            | Web 307 MB. API 970 MB because pnpm installs Prisma's peer dependencies (CLI, TypeScript) even in production. It works, and slimming it is scheduled in M8 (target under 300 MB). The build fails fast with a clear message if a native package download breaks |

## Tests (results)

| Suite                                                                                                                                    | Result                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Shared unit tests (money, dates, enums)                                                                                                  | 18 / 18 ✅                                                                                                    |
| API unit tests (env validation, error shape, enum sync)                                                                                  | 35 / 35 ✅                                                                                                    |
| API integration (health, partial indexes, read-only activity log)                                                                        | 4 / 4 ✅                                                                                                      |
| Browser tests at 4 widths (render, no sideways scroll, axe 0 serious, 404, skip link, menus, dialog reason, OTP paste, phone formatting) | 60 / 60 ✅ (8 skipped by design). Includes a crawl that follows every link and fails on any 404 or error page |
| Lint + typecheck (4 packages) + production builds                                                                                        | ✅                                                                                                            |

## Demo & sign-off

I'll show you this, and you confirm before M2 starts:

- [ ] `pnpm dev` brings everything up. `http://localhost:4000/api/v1/health` is OK
- [ ] **Styleguide** at `http://localhost:3000/styleguide` on a phone and on desktop. Please approve the look: colours, fonts, buttons, cards, pills
- [ ] Keyboard-only walk through the styleguide, with the focus ring visible everywhere
- [ ] The 404 page, and each of the 4 shells (`/`, `/sign-in`, `/dashboard`, `/teach`, `/admin`)
- [ ] Swagger at `http://localhost:4000/api/docs`. All tables exist and the seed data is in place (`pnpm db:studio`)
- [ ] CI green on GitHub (needs the Natik-owned repository; every step already passes locally)

**Your confirmation:** ☐ Approved, go to M2 · ☐ Changes needed: ________
