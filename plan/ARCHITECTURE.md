# Architecture

This is the technical reference for every milestone. If code and this file disagree, update this file in the same change.

## 1. System overview

```
                 ┌──────────────────────────── Cloudflare (DNS, HTTPS, CDN for static) ───┐
 Browser ───────►│                                                                         │
 (phone/desktop) │   /            ──► web   (Next.js, server-rendered pages)               │
                 │   /api/v1/*    ──► api   (NestJS, JSON API, permission checks)          │
                 └──────────────────────────────────────────────────────────────────────────┘
                                         │
              ┌──────────────┬───────────┼──────────────┬───────────────┬──────────────┐
              ▼              ▼           ▼              ▼               ▼              ▼
         PostgreSQL        Redis      worker       File storage    Video service   SMS gateway
         (all records)  (queues,   (jobs: SMS,     (S3-compatible, (Bunny Stream,  (Ethiopian
                        rate limits) expiry, PDFs)  private bucket) private embed)  provider)
```

- **One origin.** The site and the API share a domain, so the session cookie is first-party. A reverse proxy routes `/api/*` to the API in production. Next.js rewrites do the same job in development.
- **The API is the only gatekeeper.** Every permission check happens there (BR-ROLE-003, NFR-SEC-003). The web app never trusts its own checks.
- **The worker runs the same NestJS codebase in a separate process.** It handles queues and scheduled jobs, and renders certificate PDFs.

## 2. Tech choices and why

| Concern                   | Choice                                                                                     | Why                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Runtime                   | Node.js LTS (24.x)                                                                         | One language end to end                                                                                     |
| Web                       | Next.js (App Router), React Server Components                                              | Server-rendered public pages load fast on 3G/4G (NFR-PERF-001). Very little client JavaScript               |
| Styling                   | Tailwind CSS v4 with brand tokens, plus Radix UI primitives (shadcn/ui-style)              | Accessible behaviour built in, fully restyled to Natik                                                      |
| Forms                     | react-hook-form + zod (schemas shared with the API)                                        | One set of validation rules for browser and server                                                          |
| Client data               | TanStack Query                                                                             | Caching, retries, optimistic "Mark complete"                                                                |
| API                       | NestJS + `nestjs-zod` + `@nestjs/swagger`                                                  | Modules match the SRS modules (NFR-MAINT-002). OpenAPI document generated automatically for handover (§7.2) |
| ORM / DB                  | Prisma + PostgreSQL                                                                        | Typed queries, migrations, managed hosting widely available                                                 |
| Queue / cron / rate limit | Redis + BullMQ + `@nestjs/throttler` (Redis storage)                                       | SMS retries, timed jobs, limits that work across instances                                                  |
| Rich text                 | Tiptap (ProseMirror JSON), sanitised HTML on render                                        | Headings, bold, lists, links, images, and a right-to-left toggle per paragraph (FR-TEACH-003)               |
| PDF viewing               | pdf.js (lazy-loaded)                                                                       | Android browsers download PDFs instead of showing them. pdf.js keeps them in the page (FR-LEARN-008)        |
| Certificates              | HTML template rendered by headless Chromium (Playwright) in the worker                     | Correct shaping for Arabic and Ethiopic names. Rarely runs, so the cost is fine                             |
| Images                    | `sharp` (server), `next/image` (web)                                                       | Compressed and sized for each device (NFR-PERF-003)                                                         |
| Passwords                 | Argon2id                                                                                   | NFR-SEC-002                                                                                                 |
| i18n                      | `next-intl`, all strings in `messages/en.json`                                             | Afaan Oromo and Amharic interfaces can be added later (NFR-MAINT-003)                                       |
| Errors / uptime           | Sentry + uptime monitor                                                                    | NFR-REL-003                                                                                                 |
| Tests                     | Vitest (unit), Supertest (API), Playwright (E2E, mobile + desktop), axe, Lighthouse CI, k6 | Proves acceptance tests AT-01…16                                                                            |

## 3. Repository layout

```
natik/
├─ apps/
│  ├─ web/                    Next.js
│  │  ├─ app/
│  │  │  ├─ (public)/         home, about, courses, contact, faq, verify …
│  │  │  ├─ (account)/        register, sign-in, forgot/reset/set password
│  │  │  ├─ (student)/        dashboard, learn/…, certificates, payments, profile
│  │  │  ├─ teach/            teacher area
│  │  │  └─ admin/            admin area
│  │  ├─ components/ui/       design-system components (DESIGN.md §6)
│  │  ├─ components/features/ lesson-view, quiz-player, course-card …
│  │  ├─ lib/                 api client, auth helpers, formatters
│  │  └─ messages/en.json     every interface string
│  └─ api/                    NestJS
│     ├─ src/modules/         one folder per module (§4)
│     ├─ src/common/          access-policy, guards, filters, audit, storage, sms, video
│     ├─ src/main.ts          HTTP entry
│     ├─ src/worker.ts        queue and cron entry
│     └─ prisma/              schema.prisma, migrations/, seed.ts
├─ packages/
│  ├─ shared/                 zod schemas, enums, phone + money + date utils, error codes
│  └─ config/                 tsconfig, eslint, prettier presets
├─ docker/                    compose files (dev: postgres, redis, rustfs (S3), mailpit)
├─ .github/workflows/         CI
└─ plan/                      this plan
```

## 4. API modules (match the SRS modules)

| Module          | Owns                                                          | SRS                               |
| --------------- | ------------------------------------------------------------- | --------------------------------- |
| `auth`          | register, OTP, sign-in, sessions, password reset/set          | AUTH                              |
| `users`         | profiles, admin user management, owner rules                  | AUTH, ADMIN-002, ROLE-004         |
| `catalog`       | courses, languages, levels, course teachers, public catalogue | CAT, ADMIN-003/004                |
| `content`       | units, lessons, blocks, files, videos                         | TEACH, LEARN-006…011              |
| `enrolments`    | enrolment state machine, access checks, expiry                | ENR                               |
| `payments`      | payment submissions, queue, cash, payment accounts            | PAY                               |
| `learning`      | lesson progress, last lesson, student dashboard               | STU, LEARN-001…005                |
| `quizzes`       | quizzes, questions, attempts, marking, grants                 | QUIZ, TEACH-005                   |
| `certificates`  | issue, PDF, verify, cancel                                    | CERT                              |
| `notifications` | SMS outbox, announcements, read markers                       | NOTIF                             |
| `site`          | website content, FAQ, testimonials, policies, inbox           | WEB, ADMIN-007                    |
| `reports`       | dashboards, reports, CSV export                               | REP-001/002, ADMIN-001, TEACH-006 |
| `audit`         | activity log writer and reader                                | REP-003/004                       |
| `settings`      | key-value settings (signatory, payment accounts…)             |                                   |

Each module follows the same pattern: `controller → service → repository (Prisma)`. Permission checks go through `common/access-policy`.

## 5. Data model

Prisma is the source of truth, and M1 writes the full schema. Conventions: every table has `id` (cuid), `createdAt` and `updatedAt`. Times are stored as UTC `timestamptz` and shown in EAT (`Africa/Addis_Ababa`). Money is stored as an integer in **santim** (ETB × 100). Nothing that holds results is ever cascade-deleted (FR-ENR-009, FR-TEACH-008).

```
Branch            name ("Main Centre")                          ← growth hook (§8.1)

User              branchId, fullName, phone UNIQUE (+2519…/+2517…), email?, passwordHash?,
                  role STUDENT|TEACHER|ADMIN, isOwner, status ACTIVE|DISABLED,
                  phoneVerifiedAt?, photoFileId?, interestLanguageId?, bio?, showOnWebsite,
                  failedSignIns, lockedUntil?, lastSignInAt?, lastActiveAt?,
                  termsAcceptedAt, ageConfirmedAt, anonymisedAt?
Session           userId, tokenHash UNIQUE, kind PERSISTENT|BROWSER|STAFF,
                  expiresAt, lastSeenAt, ip, userAgent
OtpCode           phone, purpose VERIFY_PHONE|RESET_PASSWORD, codeHash, expiresAt,
                  consumedAt?, wrongTries                       INDEX(phone, createdAt)
PasswordToken     userId, tokenHash, expiresAt, usedAt?          (SMS "set password" links)

Language          name, code, direction LTR|RTL, order, active  (editable list, FR-CAT-001)
Level             name, order, active
Course            branchId, slug UNIQUE, title, languageId, levelId, summary, description(rich),
                  outcomes[], imageFileId?, durationText, access FREE|PAID, priceSantim?,
                  accessDays? (null = unlimited), status DRAFT|PUBLISHED|HIDDEN,
                  featured, featuredOrder
CourseTeacher     courseId + teacherId (PK)
Unit              courseId, title, order, status
Lesson            unitId, courseId, title, order, status, isFreePreview, downloadsAllowed
LessonBlock       lessonId, type TEXT|VIDEO|PDF|AUDIO|IMAGE, order, textJson?, fileId?, videoId?, caption?
FileAsset         purpose, storageKey, mime, sizeBytes, originalName, isPublic, uploadedById
VideoAsset        provider, providerVideoId, title, status UPLOADING|PROCESSING|READY|FAILED, durationSec?

Enrolment         branchId, studentId, courseId, status (§6), statusChangedAt, startAt?, endAt?,
                  completedAt?, progressPct, lastLessonId?, lastOpenedAt?, expiryReminderSentAt?
                  PARTIAL UNIQUE(studentId, courseId) WHERE status IN (AWAITING_PAYMENT,
                  PAYMENT_SUBMITTED, ACTIVE)
EnrolmentEvent    enrolmentId, fromStatus?, toStatus, actorId?, reason?, at   (change history)
Payment           branchId, enrolmentId, kind NEW|RENEWAL, method BANK|MOBILE_WALLET|CASH,
                  reference?, referenceNorm?, amountSantim, expectedSantim, paidOn(date),
                  receiptFileId?, status SUBMITTED|CONFIRMED|REJECTED,
                  checkedById?, checkedAt?, rejectionReason?
                  PARTIAL UNIQUE(referenceNorm) WHERE status IN (SUBMITTED, CONFIRMED)
PaymentAccount    type BANK|MOBILE_WALLET, provider, accountName, accountNumber, note?, order, active
LessonProgress    studentId + lessonId (PK), completedAt?, lastOpenedAt

Quiz              lessonId UNIQUE, courseId, title, instructions?, isFinal, passMarkPct,
                  maxAttempts? (null = unlimited), timeLimitSec?, showAnswers, status
                  PARTIAL UNIQUE(courseId) WHERE isFinal
Question          quizId, order, type MULTIPLE_CHOICE|TRUE_FALSE|FILL_BLANK|SHORT_ANSWER,
                  text, mediaFileId?, options(json), correct(json, never sent before submit),
                  marks (default 1), explanation?
QuizAttempt       quizId, studentId, enrolmentId, number, status IN_PROGRESS|SUBMITTED|
                  WAITING_FOR_MARKING|GRADED, startedAt, deadlineAt?, submittedAt?, gradedAt?,
                  score?, maxScore, scorePct?, passed?, questionsSnapshot(json)
Answer            attemptId + questionId UNIQUE, response(json), isCorrect?, marksAwarded?,
                  teacherComment?, markedById?, markedAt?
AttemptGrant      quizId, studentId, extraAttempts, grantedById          (FR-QUIZ-012)

Certificate       number UNIQUE (NLC-YYYY-NNNNN), studentId, courseId, enrolmentId,
                  studentNameSnapshot, courseTitleSnapshot, issuedAt, status VALID|CANCELLED,
                  pdfFileId?, cancelReason?, cancelledById?, cancelledAt?
CertificateCounter year (PK), last

Announcement      branchId, title, body(rich), audience PUBLIC|ALL_STUDENTS|COURSE, courseId?,
                  authorId, publishAt
AnnouncementRead  userId + announcementId (PK), readAt
InboxMessage      type CONTACT|PROBLEM_REPORT, name, phone, message, userId?, lessonId?,
                  status NEW|CLOSED, closedById?, closedAt?
SiteContent       key (PK, e.g. "home.hero"), value(json), updatedById
FaqItem           question, answer, order, published
Testimonial       name, quote, courseLabel?, photoFileId?, order, published
PolicyPage        slug privacy|terms (PK), title, body(rich)
Setting           key (PK), value(json)                       (signatory, SMS sender …)
SmsMessage        to, template, body, status QUEUED|SENT|FAILED, attempts, providerId?, lastError?
AuditLog          at, actorId?, action, entityType, entityId, details(json), ip?
                  → UPDATE/DELETE blocked by a database trigger (FR-REP-004)
```

## 6. Status machines

Each machine lives in one service. Any transition not in the table is refused.

**Enrolment** (SRS §4.2, Figure 2)

| From              | To                | Trigger                                                     |
| ----------------- | ----------------- | ----------------------------------------------------------- |
| (new)             | ACTIVE            | Free course enrol, or admin enrols the student directly     |
| (new)             | AWAITING_PAYMENT  | Student picks a paid course                                 |
| AWAITING_PAYMENT  | PAYMENT_SUBMITTED | Student submits a reference                                 |
| AWAITING_PAYMENT  | CANCELLED         | 7 days without a reference (job), or admin removes (reason) |
| PAYMENT_SUBMITTED | ACTIVE            | Admin confirms the payment (SMS sent)                       |
| PAYMENT_SUBMITTED | AWAITING_PAYMENT  | Admin rejects (reason, SMS sent)                            |
| ACTIVE            | COMPLETED         | All published lessons done and final quiz passed            |
| ACTIVE            | EXPIRED           | End date passed (job)                                       |
| ACTIVE            | CANCELLED         | Admin removes (reason required)                             |
| EXPIRED           | ACTIVE            | Admin renews, or a renewal payment is confirmed             |

Access rule: content opens only when the status is **ACTIVE**, or **COMPLETED and before `endAt`** (read-only). Every transition writes an `EnrolmentEvent` and an `AuditLog` row.

**Payment:** SUBMITTED → CONFIRMED, or SUBMITTED → REJECTED (reason required). Cash is created as CONFIRMED.
**Content (course/unit/lesson/quiz):** DRAFT → PUBLISHED ⇄ HIDDEN. Students see an item only if it **and its parents** are PUBLISHED.
**Quiz attempt:** IN_PROGRESS → SUBMITTED → GRADED, or → WAITING_FOR_MARKING → GRADED.

## 7. API conventions

- Base path `/api/v1`, JSON only, nouns for resources, plus action routes for transitions (`POST /admin/payments/:id/confirm`).
- Input is validated with shared zod schemas. One error shape everywhere:
  `{ "error": { "code": "PAYMENT_REFERENCE_DUPLICATE", "message": "This reference was already submitted…", "fields": { … } } }`
- Lists use `?page=&pageSize=` (max 50) and return `{ items, total }`.
- Dates go over the wire as ISO-8601 UTC. Money goes over as integer santim. The web app formats both (`ETB 1,500`, `4 Nov 2026`).
- Response DTOs are role-aware. For example, a teacher's view of a student never includes phone or payments (BR-ROLE-002).
- The OpenAPI document is served at `/api/docs` outside production and exported to `openapi.json` at handover.

## 8. Authentication and sessions

| Rule              | Implementation                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login ID          | Phone, normalised to E.164 (`09…`, `07…`, `+251…`, `251…` → `+2519…`/`+2517…`) by one shared function (BR-AUTH-002)                                                    |
| Passwords         | Argon2id. At least 8 characters with at least one letter and one number. Never logged or returned                                                                      |
| Sessions          | Random 32-byte token in an `httpOnly; Secure; SameSite=Lax` cookie. Only its SHA-256 hash is stored in `Session`                                                       |
| Students          | "Keep me signed in" gives 30 days. Otherwise a browser-session cookie (server expiry 12 h)                                                                             |
| Staff             | 60-minute idle timeout, sliding on each request (BR-AUTH-006)                                                                                                          |
| Reset password    | Revokes every other session (FR-AUTH-005)                                                                                                                              |
| Lockout           | 5 wrong passwords in 15 minutes locks the account for 15 minutes (BR-AUTH-005)                                                                                         |
| Account existence | Sign-in and forgot-password give the same answer whether or not the account exists. A dummy hash keeps timing equal (FR-AUTH-004)                                      |
| OTP               | 6 digits, cryptographically random, stored hashed. Valid 10 minutes, single use, at most 5 per phone per hour, resend after 60 seconds, at most 5 wrong tries per code |
| CSRF              | SameSite=Lax cookie, an `Origin` check on every non-GET request, and GET requests never change data                                                                    |

## 9. Authorisation (permission layer)

The guards are `@Roles()` for role checks and `AccessPolicy` for record-level checks. Every service calls the policy. Controllers never decide access on their own.

| Check                                | Rule                                                                                                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canEditCourseContent(user, course)` | Admin, or a teacher assigned to the course                                                                                                                                                                                       |
| `canEditCourseSettings(user)`        | Admin only (price, access, Free/Paid, teachers, featured)                                                                                                                                                                        |
| `canOpenLesson(user, lesson)`        | Staff as above. Free-preview lessons open for anyone. Students need a valid enrolment (§6). The answer includes a **reason** code for the UI: `NOT_ENROLLED`, `AWAITING_PAYMENT`, `PAYMENT_UNDER_REVIEW`, `EXPIRED`, `CANCELLED` |
| Own records                          | Students only see rows where `studentId = me` (BR-ROLE-001)                                                                                                                                                                      |
| Teacher → students                   | Only students enrolled in their courses, with no phone and no payments (BR-ROLE-002)                                                                                                                                             |
| Admins                               | Only the Owner creates admins. The last Owner can't be removed. Nobody changes their own role (BR-ROLE-004)                                                                                                                      |

## 10. Files and media

- **Upload:** `POST /api/v1/files` (multipart, streamed to storage). The server checks the real file type from its magic bytes and the size limit before saving (NFR-SEC-004).

  | Purpose                                         | Types                                        | Max   |
  | ----------------------------------------------- | -------------------------------------------- | ----- |
  | Lesson PDF                                      | pdf                                          | 25 MB |
  | Lesson audio                                    | mp3, m4a, ogg, wav                           | 25 MB |
  | Images (lesson, course, site, avatar, question) | jpg, png, webp, converted to responsive webp | 5 MB  |
  | Payment receipt                                 | jpg, png, webp, pdf                          | 5 MB  |

- **Download:** `GET /api/v1/files/:id` runs the access check on every request, then streams the file from private storage (with byte-range support). Lesson files are streamed by the API rather than redirected, so the in-page PDF reader needs no storage CORS setup. Profile photos still use a 5-minute signed redirect (FR-LEARN-010). The `Content-Disposition` header follows the lesson's "downloads allowed" setting.
- **Video:** teachers upload straight to Bunny Stream with resumable (TUS) uploads, so a dropped connection doesn't restart. Playback uses token-signed embed URLs, and the library only allows Natik's domain (FR-LEARN-007). The player is click-to-load, with no autoplay and no preload (FR-LEARN-006).
- Video sits behind a `VideoProvider` interface, so switching to Vimeo means writing one adapter.

## 11. Background jobs (worker, EAT schedule)

| Job                      | When            | Does                                                                                                             |
| ------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `sms.send`               | queued          | Sends through the gateway, retries 3× (1, 5, 15 min), then marks FAILED for the admin view (FR-NOTIF-004)        |
| `enrolment.cancelUnpaid` | hourly          | AWAITING_PAYMENT older than 7 days → CANCELLED                                                                   |
| `enrolment.expire`       | daily 00:05     | ACTIVE past `endAt` → EXPIRED                                                                                    |
| `enrolment.remindExpiry` | daily 09:00     | SMS 3 days before `endAt`, sent once (FR-ENR-008)                                                                |
| `quiz.autoSubmit`        | every minute    | Submits IN_PROGRESS attempts past their deadline (FR-QUIZ-007)                                                   |
| `progress.recalc`        | on publish/hide | Recalculates `progressPct` for the course's enrolments                                                           |
| `certificate.render`     | queued          | Builds the PDF and stores it privately                                                                           |
| `retention.cleanup`      | daily 02:00     | Deletes unverified, inactive accounts older than 30 days. Anonymises accounts 3 years after last activity (§8.2) |

## 12. SMS messages (the only ones sent, per FR-NOTIF-003)

| Template            | Text (kept under 160 characters)                                           |
| ------------------- | -------------------------------------------------------------------------- |
| `otp.verify`        | `Natik: your code is 123456. It expires in 10 minutes.`                    |
| `otp.reset`         | `Natik: your password reset code is 123456. It expires in 10 minutes.`     |
| `account.created`   | `Natik: an account was created for you. Set your password: {shortLink}`    |
| `password.link`     | `Natik: set a new password here: {shortLink}`                              |
| `payment.confirmed` | `Natik: payment confirmed. "{course}" is now open. Happy learning!`        |
| `payment.rejected`  | `Natik: we couldn't confirm your payment for "{course}". Reason: {reason}` |
| `access.expiring`   | `Natik: your access to "{course}" ends on {date}. Contact us to renew.`    |

## 13. Environments and configuration

| Environment | Purpose                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| local       | Docker Compose: Postgres, Redis, RustFS (S3-compatible; MinIO stopped publishing images), Mailpit. Console SMS, dev SMS inbox page |
| staging     | The test site Natik reviews and tests (NFR-MAINT-001)                                                                              |
| production  | The live site. Same images as staging, different secrets                                                                           |

Configuration comes only from environment variables, validated with zod at start-up, and no secret is ever committed (NFR-SEC-006). Main variables: `DATABASE_URL`, `REDIS_URL`, `APP_URL`, `S3_*`, `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER`, `VIDEO_PROVIDER`, `BUNNY_*`, `OTP_PEPPER`, `SENTRY_DSN`, `SEED_OWNER_PHONE`, `SEED_OWNER_PASSWORD`, optional `SMTP_*`.

## 14. Testing strategy

| Level             | Tool                                              | Focus                                                                             |
| ----------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Unit              | Vitest                                            | Phone normalisation, money, state machines, marking rules, progress maths         |
| API integration   | Vitest + Supertest + real Postgres                | Every endpoint: allowed role, denied role, other user's record (IDOR), validation |
| Permission matrix | generated test                                    | Every route × every role, compared to SRS §3                                      |
| E2E               | Playwright (Pixel 5 + iPhone 13 + Desktop Chrome) | The SRS §6 user flows and AT-01…15                                                |
| Accessibility     | axe in Playwright                                 | 0 serious violations                                                              |
| Performance       | Lighthouse CI, k6                                 | NFR-PERF budgets, 100 concurrent students                                         |

## 15. Room to grow (built in now, used later)

- `branchId` on users, courses, enrolments, payments and announcements, all set to "Main Centre".
- Languages and levels are tables, not code.
- Payments sit behind a `PaymentMethod` shape, so a gateway (Chapa, telebirr) can confirm automatically later.
- All interface strings are in translation files. Content `lang`/`dir` comes from the course language.
- SMS, video and storage each sit behind an adapter interface.

## 16. Notes added during the build

- **Public pages are static and cached** (M4). They are rendered once, refreshed every 10 seconds, and refreshed at once when an admin saves in the website editor (`updateTag('site')` from a server action). They never read the session on the server; the parts that differ for signed-in people (header "Dashboard", course page button) ask `/api/v1/me` in the browser (`useSession`).
- **`@natik/shared` is built twice:** CommonJS for the API, ES modules (with `sideEffects: false`) for the website, plus narrow entry points (`@natik/shared/errors`, `/money`, …). Code that runs on every page imports from the narrow entry points so the validation library stays out of public pages.
- **Lesson files are streamed by the API** with an access check on every request (see §10).
- **Enrolment status changes go through one class** (`EnrolmentMachine`, M5): it checks the transition table, only applies if the enrolment is still in the status the caller saw, and writes the history row. Callers record the activity-log entry after their database transaction commits, so a rolled-back change never leaves a log line. The table has two additions to the SRS figure: admin cash from "awaiting payment", and cancel from "under review" or "expired".
- **The worker is a separate process** (`node dist/worker.js`) that loads only the queue processors, not the API's feature modules. Anything a processor needs (for example the activity log) must be imported by its own worker module. `jobs/worker.int-spec.ts` builds the worker so a missing import fails in CI instead of at launch.
- **Repeating jobs register themselves** on worker start (`upsertJobScheduler`, East Africa Time), so there is no separate scheduler to deploy.
- **Receipts** are `FileAsset`s with purpose RECEIPT, served only to the student who uploaded them and to admins (`GET /files/:id`).
- **Quiz questions are copied into each attempt** (`QuizAttempt.questionsSnapshot`), so editing a quiz never changes an attempt in progress or a past result. Marking, results and the marking queue read the copy, not the live question.
- **Time is kept by the server** (`deadlineAt`). The browser shows a countdown corrected for its own clock, saves each answer on its own, and keeps unsent answers on the device. A per-minute job submits attempts that ran out.
- **One class closes attempts** (`AttemptGrader`): a student's submit, the time-out job and a teacher's last mark all end the same way, and a pass moves the lesson and then the course forward. Course completion queues a `certificate.issue` job; the certificate list also issues any missing one, so a stopped worker never leaves a student without it.
- **Certificates are printed by headless Chromium** inside the worker (`CHROMIUM_PATH` in production). Fonts are embedded from `@fontsource` packages.
- **Reports are counted in the database** from the same rows the screens show, and the CSV writer (`common/csv.ts`) is the only place files are formatted, so every export gets the Excel-safe rules (byte-order mark, CRLF, formula defusing).
- **Teacher views simply never select phone or payment fields**, so there is nothing to leak; the teacher CSV and screen share one query.
- **Erasing a person keeps the records the law and the centre need** (anonymised results, payments, certificates with their printed name) and removes who they are. The same code serves a request from an admin and the 3-year rule.
- **Lists of "all courses" for admin pickers use the public catalogue** (up to 200), because the paged admin list caps at 50 and a growing centre would otherwise lose courses from the cash and enrolment dialogs.
