# Natik Language Centre: Implementation Plan

The production build of the Natik website and online learning platform (MVP).
Source of truth: **SRS NLC-SRS-003 v3.0**, which has 134 requirements (122 Must, 12 Should).

<p align="center"><img src="assets/natik-logo.png" width="160" alt="Natik Language Centre logo"></p>

| Brand colour | Hex       | Use                                                                  |
| ------------ | --------- | -------------------------------------------------------------------- |
| Navy         | `#123B5A` | Primary: header, buttons, links, headings                            |
| Gold         | `#B69A4A` | Accents only: highlights, "completed", certificates. Never body text |
| Off-white    | `#F7F6F2` | Page background                                                      |
| Text         | `#202A32` | Body text                                                            |
| White        | `#FFFFFF` | Cards and surfaces                                                   |

---

## How we work (milestone gates)

1. I work on **one milestone at a time**, in order, and tick its task list as I go.
2. Every milestone ends with a **Demo & sign-off** checklist. I stop there and report back.
3. You try it and **confirm**, or ask for changes. I only start the next milestone after your OK.
4. Anything new that isn't in the SRS goes to **Change requests** (below), not into the current milestone.

Status key: ⬜ Not started · 🟡 In progress · 🔍 Waiting for your sign-off · ✅ Done

## Milestones

| #                                       | Milestone                             | What you can see at the end                                                                                                      | Status |
| --------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [M1](M1-foundation-design-system.md)    | Foundation & Design System            | The app runs. A styleguide shows every branded component, plus empty page shells for each area                                   | ✅     |
| [M2](M2-accounts-security.md)           | Accounts, Security & Users            | Register with phone + SMS code, sign in, reset password, profile, and the admin user list                                        | 🔍     |
| [M3](M3-course-builder.md)              | Course Builder                        | Admin creates courses. Teachers build lessons with text, video, PDF, audio and images, preview them, and publish                 | ✅     |
| [M4](M4-public-website-catalogue.md)    | Public Website & Catalogue            | Full public site: home, catalogue + filters, course pages, free lessons, contact, announcements, and a website editor for admins | ✅     |
| [M5](M5-enrolment-payments-learning.md) | Enrolment, Payments & Learning        | Free and paid enrolment, the manual payment queue, student dashboard, lesson player and progress                                 | ✅     |
| [M6](M6-quizzes-certificates.md)        | Quizzes, Marking & Certificates       | 4 question types, timed quizzes with autosave, teacher marking, certificate PDF and the verify page                              | ✅     |
| [M7](M7-admin-reports-operations.md)    | Admin Dashboard, Reports & Operations | Admin dashboard, CSV reports, activity log, teacher progress export, settings hub, data-keeping jobs                             | ✅     |
| [M8](M8-quality-security-launch.md)     | Quality, Security & Launch            | All 16 acceptance tests passing, security, speed and device checks, backups, go-live and handover                                | 🟡     |

Reference files used by every milestone:

- [ARCHITECTURE.md](ARCHITECTURE.md): stack, repo layout, data model, status machines, API, security, jobs
- [DESIGN.md](DESIGN.md): UI/UX rules, brand tokens, components, layouts, and the "keep pages light" rules

```
M1 ─► M2 ─► M3 ─► M4 ─► M5 ─► M6 ─► M7 ─► M8
                     (each arrow = your confirmation)
```

## Tech stack (summary)

Details and reasons are in [ARCHITECTURE.md](ARCHITECTURE.md). This follows SRS Appendix B.

| Layer         | Choice                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------- |
| Web app       | Next.js (App Router) + TypeScript + Tailwind CSS. Server-rendered for fast mobile loading |
| API           | NestJS + TypeScript, REST JSON under `/api/v1`, OpenAPI docs                              |
| Database      | PostgreSQL + Prisma                                                                       |
| Jobs & limits | Redis + BullMQ (SMS queue, scheduled jobs, rate limiting)                                 |
| Files         | S3-compatible private storage, short-lived signed links                                   |
| Video         | Bunny Stream (recommended; final choice in Phase 1, per D8), behind an adapter            |
| SMS           | Ethiopian SMS gateway behind an adapter (console driver for development)                  |
| Monorepo      | pnpm workspaces + Turborepo                                                               |
| Tests         | Vitest, Supertest, Playwright, Lighthouse CI, k6                                          |

## Definition of Done (applies to every milestone)

- [ ] All tasks in the milestone file are ticked, and CI is green (lint, types, tests, build)
- [ ] Every new screen is checked at 320 px, tablet and desktop, with loading, empty, error and success states
- [ ] Every new screen passes an axe scan (0 serious issues) and works with the keyboard alone
- [ ] Every new API endpoint has validated input and server-side permission checks, with tests for both allowed and denied access
- [ ] Actions the SRS names in FR-REP-003 are written to the activity log
- [ ] All interface text is in `messages/en.json` (no hard-coded strings)
- [ ] The demo checklist at the bottom of the milestone file is ready for you

## SRS coverage map

| SRS module                    | Milestone(s)                                                          |
| ----------------------------- | --------------------------------------------------------------------- |
| BR-ROLE-001…004               | M2 (permission layer), proven in M5 and M8                            |
| BR-AUTH, FR-AUTH              | M2                                                                    |
| FR-WEB-001…007                | M4                                                                    |
| FR-CAT-001…006                | M3 (languages/levels), M4 (catalogue), M5 (all button states)         |
| FR-ENR-001                    | M3 · FR-ENR-002…009: M5                                               |
| FR-PAY-001…009                | M5                                                                    |
| FR-STU-001…004                | M5 (results and certificates widgets filled in M6)                    |
| FR-LEARN-006…011              | M3 (media and RTL) · FR-LEARN-001…005, 012: M5                        |
| FR-QUIZ-001…012               | M6                                                                    |
| FR-TEACH-001…004, 007, 008    | M3 · FR-TEACH-005: M6 · FR-TEACH-006 and full TEACH-001: M7           |
| FR-ADMIN-002                  | M2 · 003…005: M3 · 007: M4 · 006: M5 · 001: M7 · 008: every milestone |
| FR-NOTIF-001                  | M4 · 002: M5 · 003: M2 + M5 · 004: M2 (retry) + M7 (admin view)       |
| FR-CERT-001…005               | M6                                                                    |
| FR-REP-001…004                | M2 (log writer) · M7 (reports and log viewer)                         |
| FR-UI-001…005                 | M1 (design system), applied everywhere                                |
| NFR-PERF                      | M4 (budgets), M8 (verification)                                       |
| NFR-SEC                       | M2 (core), M8 (audit)                                                 |
| NFR-REL                       | M1 (error logging), M8 (backups, monitoring)                          |
| NFR-USE                       | M1 (components), M8 (device and usability tests)                      |
| NFR-MAINT                     | M1 (repo, modules, translation files), M8 (handover)                  |
| §8.2 Keeping data             | M7                                                                    |
| §10 Error messages            | M1 (message file), used in every milestone                            |
| §11 Acceptance tests AT-01…16 | Built per milestone, full run in M8                                   |

## Open questions for Natik

None of these blocks the start. A sensible default is used until Natik answers.

| #   | Question                                                                                                   | Default until answered                                                             | Needed by                    |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------- |
| Q1  | Video service: Bunny Stream or Vimeo?                                                                      | Bunny Stream (private embed, cheaper, resumable uploads)                           | M3                           |
| Q2  | Which Ethiopian SMS gateway, and what sender ID?                                                           | Console driver in development                                                      | M2 (live SMS by M8)          |
| Q3  | Hosting provider and region (Natik-owned account)                                                          | Docker images ready for any provider                                               | Staging after M4, prod in M8 |
| Q4  | Renewing a **free** course after it expires: instant, or by contacting Natik?                              | Instant re-activation for free courses. Paid renewals go through the payment check | M5                           |
| Q5  | Does the 7-day unpaid timer restart after a rejected payment?                                              | Yes, it restarts when the enrolment returns to AWAITING_PAYMENT                    | M5                           |
| Q6  | How long is the "set your password" SMS link valid?                                                        | 72 hours, single use                                                               | M2                           |
| Q7  | Bank and mobile-wallet accounts to show on the payment screen                                              | Placeholder accounts in staging                                                    | M5                           |
| Q8  | Certificate signatory: name, title and signature image                                                     | Placeholder                                                                        | M6                           |
| Q9  | If a student asks for deletion, does their name stay on issued certificates so they can still be verified? | Yes, name kept on the certificate record only                                      | M7                           |
| Q10 | Logo as SVG, plus a reversed (white/gold) version for navy backgrounds                                     | Use the PNG in `assets/` for now                                                   | M1                           |

## Change requests

Record new ideas here. They are assessed for time and cost before they are scheduled (SRS §11.2).

| Date       | Request                                                                                                                      | Decision                                                                                                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8 Nov 2026 | **CR-1:** Remove SMS verification at registration; sign in with phone and password only (changes SRS D3, FR-AUTH-002, AT-02) | Accepted. Registering signs the person in and sends no SMS. Trade-offs: nothing proves a number belongs to the person who typed it, and Natik can't be sure a number is reachable. SMS stays only for password reset and admin-sent links |
| 10 Nov 2026 | **CR-2:** Interactive Learning Academy: lesson stages, slides, video upgrades, vocabulary, practice games, time tracking, dashboard and public-site additions. See [ACADEMY-PLAN.md](ACADEMY-PLAN.md) | Proposed. Waiting for your answers to the six decisions in the plan. No code changes until approved |
