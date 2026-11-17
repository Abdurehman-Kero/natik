# Acceptance traceability (SRS §11)

Where each acceptance test is proved automatically. All of these run in CI. "API" = integration tests in
`apps/api`, "Browser" = Playwright tests in `apps/web/e2e` on phone (320 px and a Pixel 5), tablet and desktop.

| AT  | What                                       | Proved by                                                                                                                                               |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Catalogue and free preview                 | Browser `public.spec`, `website.spec` (free lessons) · API `public.int-spec`                                                                            |
| 02  | Register and sign in                       | Browser `accounts.spec` · API `auth.int-spec`                                                                                                           |
| 03  | Lockout and password reset                 | Browser `accounts.spec` · API `auth.int-spec`                                                                                                           |
| 04  | Free enrolment                             | Browser `enrolment.spec` · API `enrolment.int-spec`                                                                                                     |
| 05  | Paid enrolment, payment, confirm           | Browser `enrolment.spec` · API `enrolment.int-spec`                                                                                                     |
| 06  | Reject, duplicate reference, cash          | Browser `enrolment.spec` · API `enrolment.int-spec`                                                                                                     |
| 07  | No access without enrolment (direct links) | API `enrolment.int-spec`, `quizzes.int-spec` · **`permission-matrix.int-spec`** (every route × every role)                                              |
| 08  | One student can't reach another's records  | API `enrolment.int-spec`, `quizzes.int-spec` · Browser `enrolment.spec`                                                                                 |
| 09  | Progress and "Continue learning"           | API `enrolment.int-spec` · Browser `enrolment.spec`                                                                                                     |
| 10  | Quizzes: types, attempts, timer, offline   | API `quizzes.int-spec`, `quiz-grading.spec` · Browser `quizzes.spec`                                                                                    |
| 11  | Short answers marked by teacher            | API `quizzes.int-spec` · Browser `quizzes.spec`                                                                                                         |
| 12  | Teacher content and limits                 | API `content.int-spec` · Browser `course-builder.spec`                                                                                                  |
| 13  | Certificate and verify                     | API `quizzes.int-spec` (PDF, numbering, cancel) · Browser `quizzes.spec`                                                                                |
| 14  | Reports, CSV, activity log                 | API `reports.int-spec`, `csv.spec` · Browser `operations.spec`                                                                                          |
| 15  | Arabic right-to-left                       | Browser `course-builder.spec`, `quizzes.spec` (Arabic content) · **real-device check still to do**                                                      |
| 16  | Speed, backup restore, security            | Speed: Lighthouse CI (`pnpm lhci`) · Security: permission matrix, upload checks, rate-limit tests · **restore drill and load test are done on staging** |

Cross-cutting checks run on every screen size: no sideways scrolling and no serious accessibility issues (axe).
