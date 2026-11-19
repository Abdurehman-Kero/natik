# M8: Quality, Security & Launch

|                |                                            |
| -------------- | ------------------------------------------ |
| **Status**     | 🟡 Code side done; launch steps need Natik |
| **Depends on** | M7 confirmed                               |
| **Unlocks**    | Go-live + 90-day warranty                  |
| **Size**       | Large                                      |

## Goal

Prove the MVP meets every Must requirement, harden it, and go live with backups, monitoring, trained staff and a full handover. This matches SRS §12 phases 4 (Test) and 5 (Launch).

## Scope

**In:** the full acceptance suite, the permission matrix, security review, speed and load tests, accessibility and real-device testing, a usability test, infrastructure (staging + production), backups and a restore drill, monitoring, content loading, handover documents, Natik acceptance testing, launch, training.
**Out:** new features. Anything new goes to README › Change requests.

## SRS covered

§11 AT-01…16 · NFR-PERF-001…003 · NFR-SEC-001…008 · NFR-REL-001…003 · NFR-USE-001…004 · NFR-MAINT-001, 004, 005 · §11.2 acceptance rules · §12 phases 4–5

---

## 1. Acceptance test suite

- [ ] Playwright E2E for **AT-01 … AT-15** on 3 device profiles (Pixel 5, iPhone 13, Desktop Chrome), running in CI against a seeded staging-like database
- [ ] AT-16 checklist (speed, backup restore, security), with evidence attached
- [ ] Generated **traceability report**: each of the 134 requirements → milestone → test(s) → pass/fail. Every Must requirement must be green

| AT                                                      | Test file                                 |
| ------------------------------------------------------- | ----------------------------------------- |
| AT-01 catalogue + free preview                          | `e2e/catalogue.spec.ts`                   |
| AT-02/03 register, verify, sign in, lockout, reset      | `e2e/auth.spec.ts`                        |
| AT-04…06 free enrol, paid flow, reject, duplicate, cash | `e2e/enrolment-payments.spec.ts`          |
| AT-07/08 direct links and ID tampering                  | `e2e/access-control.spec.ts` + API matrix |
| AT-09 progress + continue learning                      | `e2e/learning.spec.ts`                    |
| AT-10/11 quizzes, timer, offline, marking               | `e2e/quizzes.spec.ts`                     |
| AT-12 teacher content + limits                          | `e2e/teacher.spec.ts`                     |
| AT-13 certificate + verify                              | `e2e/certificates.spec.ts`                |
| AT-14 reports + CSV + activity log                      | `e2e/reports.spec.ts`                     |
| AT-15 Arabic RTL on 3 devices                           | `e2e/rtl.spec.ts` + manual device check   |

## 2. Security (NFR-SEC)

- [ ] **Permission matrix test:** every API route × {visitor, student, other student, teacher, other teacher, admin, owner}, compared to SRS §3. Fails CI on any surprise
- [ ] IDOR sweep: change every ID in every student URL and API call → no other student's data (NFR-SEC-003)
- [ ] OWASP ZAP baseline scan against staging, with no high or medium findings left open (NFR-SEC-007)
- [ ] Headers: HSTS, CSP (self + video and analytics domains only), `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy, `X-Content-Type-Options`
- [ ] Cookies `httpOnly; Secure; SameSite=Lax`. HTTPS everywhere, with HTTP redirected (NFR-SEC-001)
- [ ] Rate limits verified on sign-in, codes, contact and verify (NFR-SEC-005)
- [ ] Upload abuse tests: wrong type, oversized, renamed executables, SVG with script (images are re-encoded) (NFR-SEC-004)
- [ ] Secrets scan (gitleaks) on the full history + `pnpm audit` with no high issues (NFR-SEC-006)
- [ ] Remove the development-only quick sign-in dropdown (`apps/web/components/dev/` and its line in `sign-in-form.tsx`). It only shows in `pnpm dev`, but Natik asked for it to be deleted before launch
- [ ] Replace the sample payment accounts and sample testimonials with Natik's real ones (Admin › Settings › Payment accounts, Admin › Website)
- [ ] Logs reviewed: no passwords, codes, tokens or full phone numbers
- [ ] Privacy notice published. Natik confirms legal compliance (NFR-SEC-008)

## 3. Speed and capacity (NFR-PERF)

- [ ] Lighthouse CI (mobile, simulated 4G) on all public pages: load ≤ 3 s, homepage < 1.5 MB without video (NFR-PERF-001)
- [ ] **k6 load test:** 100 concurrent students doing dashboard → lesson → mark complete → quiz save, with p95 < 1 s for normal pages (NFR-PERF-002)
- [ ] Slow-query review (`EXPLAIN ANALYZE` on the top 20 queries) and missing indexes added
- [ ] Image audit: every image served at the right size and format (NFR-PERF-003)

## 4. Accessibility, devices and usability (NFR-USE)

- [ ] axe scan on every route: 0 serious issues (NFR-USE-002)
- [ ] Keyboard-only run through the main flows of every role
- [ ] Real devices: low-cost Android (Chrome), iPhone (Safari), desktop Chrome, Edge, Firefox and Safari, all at 320 px (NFR-USE-003, SRS §2.4)
- [ ] Throttled 3G run: the lesson page stays usable and PDFs/audio stream progressively
- [ ] **Usability test:** 3–5 real people register and open a free lesson without help, timed. Target under 5 minutes (NFR-USE-001, G2)
- [ ] Copy review: every error message is in plain words and says what to do next (NFR-USE-004)

## 5. Infrastructure and reliability (NFR-REL, NFR-MAINT)

- [ ] Natik-owned accounts: domain, hosting, database, storage, SMS, video (SRS §2.6)
- [ ] **Staging** and **production** environments built from the same Docker images (NFR-MAINT-001)
- [ ] Slim the API image (about 970 MB in M1, target under 300 MB). pnpm installs `@prisma/client`'s peer dependencies (Prisma CLI, Studio, TypeScript) even in production. Options: bundle `dist` or prune the peers, then re-verify health and worker start-up
- [ ] Cloudflare: DNS, HTTPS, static caching, basic WAF rules
- [ ] Managed PostgreSQL with automatic daily backups + point-in-time recovery
- [ ] Nightly off-site backup: `pg_dump` + storage bucket sync to a separate provider/region, **kept 30 days** (NFR-REL-002)
- [ ] **Restore drill:** restore last night's backup into a fresh environment, check the data, and record the time taken (AT-16)
- [ ] Monitoring: Sentry errors, an uptime check every minute, alerts to NilePixel (NFR-REL-003). Queue and cron health checks
- [ ] Scaling path documented: more web/API instances behind the proxy, plus database tier upgrades without redesign (NFR-MAINT-004)
- [ ] Live SMS gateway and video library switched on, with the domain allow-list set to production

## 6. Launch content

- [ ] Up to 3 launch courses loaded (from Natik's materials), reviewed by their teachers (SRS §12, §14)
- [ ] Website content, FAQ, testimonials, policies, payment accounts, signatory
- [ ] Staff accounts created → set-password SMS sent → first sign-in confirmed
- [ ] Demo/test data removed from production

## 7. Handover (NFR-MAINT-005)

- [ ] `README`: local setup, architecture summary, environment variables
- [ ] **Runbooks:** deploy, rollback, backup and restore, rotate secrets, add an admin, handle a failed SMS
- [ ] **API documentation:** exported `openapi.json` + a hosted docs page (SRS §7.2)
- [ ] **Admin guide** and **Teacher guide**: short and illustrated, one task per page (screenshots + 3–5 steps each)
- [ ] Git repository transferred to Natik's organisation (NFR-MAINT-001)
- [ ] Credentials handed to the Platform Owner (D10)

## 8. Acceptance and launch

- [ ] Release candidate on staging. **Natik tests within 10 working days** (SRS §11.2)
- [ ] Defects triaged: critical / serious fixed before sign-off, minor scheduled in the 90-day warranty
- [ ] Natik signs the acceptance
- [ ] Go-live checklist: DNS cutover · smoke test in production (register, enrol free, pay flow, quiz, certificate verify) · backups confirmed · alerts confirmed
- [ ] **Training:** half a day for admins, half a day for teachers (SRS §12)
- [ ] 90-day warranty: issue tracker set up, response times agreed (D10)

---

## Demo & sign-off (final)

- [ ] Traceability report: all 122 Must requirements and AT-01…16 green
- [ ] Security, speed and load reports with no open serious issues
- [ ] Restore drill evidence
- [ ] Device test sheet (Android, iPhone, desktop) signed off
- [ ] Handover pack delivered
- [ ] Production live on Natik's domain

**Your confirmation:** ☐ Accepted, the MVP is live · ☐ Changes needed: ________

---

## Delivered so far (build notes)

- **Permission matrix** (`src/test/permission-matrix.int-spec.ts`): finds every API route automatically and asks it as a visitor, student, teacher and admin. A visitor must get 401, a role that isn't allowed must get 403, and nothing may crash. It found one real bug (retrying an unknown SMS gave a server error; now "not found") and now guards every future route.
- **Handover pack** in `docs/`: runbooks (deploy, rollback, backup and restore drill, rotate secrets, add an admin, failed SMS, and four common situations), admin and teacher guides, the AT traceability table, and the exported `openapi.json`.
- **Already in place from earlier milestones:** security headers, rate limits, private files with magic-byte checks, activity log guarded by the database, Lighthouse budgets in CI, accessibility scan on every new screen at four sizes.
- **Speed re-check after the 2026-11 redesign (Lighthouse CI, phone, slow 4G):** the richer public pages had grown to about 345 kB of scripts (budget 256 kB) and the course list had an LCP of 4.9 s (budget 4.5 s). Fixed: the sign-in dialog and the quick dialogs (search, message, verify, find your level) now load on the visitor's first touch or key press instead of with the page; the first two course pictures load at once; translations are sent per area. Result: scripts **about 290 kB**, LCP **2.7–3.7 s** on all three budgeted pages. **Still open:** scripts are about 35 kB over the 256 kB limit, mostly the Radix menus in the header (Help menu, language switcher, phone menu). Options: replace those three menus with lighter hand-made ones, or raise the limit to 300 kB. Total blocking time (a warning, target 0.3 s) is 1.1–2.9 s on this simulated slow phone.
- **Needs Natik or real infrastructure (cannot be done from the code):** accounts for domain, hosting, database, storage, SMS and video; staging and production environments; Cloudflare; managed backups and the **restore drill**; Sentry and uptime alerts; the **k6 load test** and **OWASP ZAP scan** (both run against staging); real-device checks (Android, iPhone, desktop browsers) and the 3–5 person usability test; loading Natik's launch courses and teachers; removing the development sign-in dropdown; replacing sample payment accounts and quotes; slimming the API image (about 970 MB, target 300 MB); Natik's 10-day acceptance test; training; the 90-day warranty set-up.
