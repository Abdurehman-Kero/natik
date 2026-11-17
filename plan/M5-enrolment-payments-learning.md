# M5: Enrolment, Payments & Learning

|                |                                         |
| -------------- | --------------------------------------- |
| **Status**     | 🔍 Waiting for your sign-off              |
| **Depends on** | M4 confirmed                            |
| **Unlocks**    | M6                                      |
| **Size**       | Large (the core of the student journey) |

## Goal

Students enrol in a course, instantly if it is free or through a manual payment check if it is paid. They then learn lesson by lesson with progress saved, and always know where they stand. Admins run the payment queue and manage access.

## Scope

**In:** enrolment state machine, all course button states, payment instructions and submission, the admin payment queue (confirm, reject, cash), admin enrolment management (enrol, extend, renew, cancel), payment account settings, the student dashboard, my courses, the course outline with progress, the full lesson page (prev/next, mark complete, continue learning), access-blocked screens, payment history, the student announcement feed with unread markers, "Report a problem", expiry and cancellation jobs, payment and expiry SMS.
**Out:** quizzes, quiz-based completion and certificates (M6). Results and certificate widgets show empty states until M6.

## SRS covered

FR-ENR-002…009 · FR-PAY-001…009 · FR-STU-001…004 · FR-LEARN-001…005, 012 · FR-CAT-004 (all states) · FR-ADMIN-006, 008 · FR-NOTIF-002, 003 · BR-ROLE-001, 003 · AT-04…09

---

## The course button (FR-CAT-004)

| Who / state                      | Button                                          | Goes to                                   |
| -------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| Visitor                          | **Register to enrol**                           | `/register?next=…`                        |
| No enrolment, free course        | **Enrol free**                                  | Enrols instantly → opens lesson 1         |
| No enrolment, paid course        | **Pay and enrol**                               | `/pay/[enrolmentId]`                      |
| AWAITING_PAYMENT                 | **Pay and enrol** (continues)                   | `/pay/[enrolmentId]`                      |
| PAYMENT_SUBMITTED                | **Payment under review** (disabled, clock icon) |                                           |
| ACTIVE / COMPLETED within access | **Continue learning**                           | Last lesson opened                        |
| EXPIRED                          | **Renew access**                                | Free: instant (Q4). Paid: renewal payment |
| CANCELLED                        | Same as "no enrolment"                          |                                           |
| Teacher/admin of the course      | **Open editor**                                 | `/teach/courses/[id]`                     |

---

## Screens

| Route                        | Screen                                          | Primary action          |
| ---------------------------- | ----------------------------------------------- | ----------------------- |
| `/pay/[enrolmentId]`         | Payment instructions + submit form              | Submit payment          |
| `/dashboard`                 | Student home                                    | Continue learning       |
| `/my-courses`                | All my courses: Active · Completed · Other      | (card)                  |
| `/learn/[slug]`              | Course outline with lesson states and progress  | Continue                |
| `/learn/[slug]/lessons/[id]` | Lesson page                                     | Mark as complete / Next |
| (inline)                     | Access blocked: reason + next step (FR-ENR-006) | Depends on the reason   |
| `/profile/payments`          | Payment history and status (FR-PAY-008)         |                         |
| `/announcements` (student)   | Feed with unread markers                        |                         |
| `/admin/payments`            | Payments to check, oldest first                 | Confirm                 |
| `/admin/payments/cash`       | Record a cash payment (dialog)                  | Record payment          |
| `/admin/enrolments`          | By course or by student                         | Enrol student           |
| `/admin/settings/payments`   | Bank and wallet accounts shown to students      | Add account             |

```
Pay and enrol (mobile)
┌─────────────────────────────┐
│ ← Arabic for Beginners      │
│ Pay and enrol               │
│ ┌─────────────────────────┐ │
│ │ Amount        ETB 1,500 │ │
│ └─────────────────────────┘ │
│ ① Pay to one of these       │
│ ┌─────────────────────────┐ │
│ │ CBE · Natik Language C. │ │
│ │ 1000 1234 5678   [Copy] │ │
│ ├─────────────────────────┤ │
│ │ telebirr · Natik        │ │
│ │ 0911 223 344     [Copy] │ │
│ └─────────────────────────┘ │
│ Or pay cash at the centre.  │
│                             │
│ ② Tell us about it          │
│ Method  (Bank)(Wallet)      │
│ Reference [FT2431XYZ      ] │
│ Amount    [1500           ] │
│ Date paid [4 Nov 2026     ] │
│ Receipt photo (optional)    │
│ [ + Add photo ]             │
│                             │
│ [     Submit payment      ] │
└─────────────────────────────┘
        ↓ after submitting
┌─────────────────────────────┐
│        (clock icon)         │
│  Payment under review       │
│  We'll text you when your   │
│  access is ready.           │
│  [ Go to dashboard ]        │
└─────────────────────────────┘
```

```
Student dashboard (mobile)                 Empty dashboard
┌─────────────────────────────┐            ┌─────────────────────────────┐
│ [logo]              🔔• (AK) │            │ Hi, Abdi                    │
├─────────────────────────────┤            │                             │
│ Hi, Abdi                    │            │       (book icon)           │
│ ┌─────────────────────────┐ │            │  No courses yet             │
│ │▓ Continue learning     ▓│ │            │  Pick one to get started.   │
│ │▓ Arabic for Beginners  ▓│ │            │  [ Browse courses ]         │
│ │▓ L4 · Short vowels     ▓│ │            │  Try a free lesson →        │
│ │▓ ██████░░░░ 42%  [ → ] ▓│ │            └─────────────────────────────┘
│ └─────────────────────────┘ │
│ ▬ My courses                │
│ ┌───────────┐┌───────────┐  │
│ │English B1 ││Oromo Basic│  │
│ │██░░░ 15%  ││(Payment   │  │
│ │(Active)   ││ under rev)│  │
│ └───────────┘└───────────┘  │
│ ▬ News (2 new)       All →  │
│ • Eid holiday hours   NEW   │
│ ▬ Recent results   (M6)     │
│ ▬ Certificates     (M6)     │
├─────────────────────────────┤
│ Home  Courses  Certs Profile│
└─────────────────────────────┘
```

```
Lesson page (mobile)                       Course outline (mobile)
┌─────────────────────────────┐            ┌─────────────────────────────┐
│ ←  Short vowels  [Contents] │            │ ← Arabic for Beginners      │
│ ██████░░░░░░ 42%            │            │ ██████░░░░ 42% · 10 of 24   │
├─────────────────────────────┤            │ [ Continue: Short vowels ]  │
│        LessonView           │            ├─────────────────────────────┤
│   (video · text · PDF ·     │            │ ▾ Unit 1 · Letters    4/6   │
│    audio · images)          │            │   ✓ The alphabet            │
│                             │            │   ✓ Letter shapes           │
│ Problem with this lesson?   │            │   ● Short vowels   ← here   │
│ Report it                   │            │   ○ Long vowels             │
├─────────────────────────────┤            │ ▸ Unit 2 · Greetings  0/5   │
│ [‹]  [ ✓ Mark as complete ] [›] │        └─────────────────────────────┘
└─────────────────────────────┘             ✓ done (gold) · ● in progress · ○ not started
  sticky bar; after marking: "Completed ✓" + Next pulses
```

```
Admin › Payments to check (desktop)
┌───────────────────────────────────────────────────────────────────────┐
│ Payments to check (5)                          [+ Record cash payment]│
│ Oldest first                                                          │
├───────────────────────────────────────────────────────────────────────┤
│ Abdi Kedir · Arabic for Beginners                         2 days ago  │
│ telebirr · Ref FT2431XYZ · Paid 2 Nov 2026                            │
│ Expected ETB 1,500 · Entered ETB 1,500   ✓ Matches                    │
│ [receipt]                                     [ Reject ]  [ Confirm ] │
├───────────────────────────────────────────────────────────────────────┤
│ Sara Ali · English B1                                     1 day ago   │
│ Bank · Ref 000123987 · Paid 3 Nov 2026                                │
│ Expected ETB 1,200 · Entered ETB 1,000   ⚠ Amount differs             │
│ [receipt]                                     [ Reject ]  [ Confirm ] │
└───────────────────────────────────────────────────────────────────────┘
Reject → dialog with a required reason ("Reference not found", "Amount short", or other).
```

### UX details

- **Free enrol is one tap.** It confirms with a toast and opens lesson 1 straight away (§6.1).
- **Copy buttons** next to account numbers. The amount field is pre-filled with the course price.
- **Receipt photo** opens the phone camera or gallery (`accept="image/*"`) and is compressed on the device before upload.
- **Mark as complete** updates the progress bar immediately (optimistic), then moves focus to **Next**.
- **Lessons with a quiz** show "Pass the quiz to complete" instead of the button (rule wired in M6).
- **Blocked access** is never a dead end. Every reason has one clear button:

  | Reason           | Message (SRS §10 tone)                                                        | Button                     |
  | ---------------- | ----------------------------------------------------------------------------- | -------------------------- |
  | Not enrolled     | "You're not enrolled in this course yet."                                     | Enrol free / Pay and enrol |
  | Awaiting payment | "Finish your payment to open this course."                                    | Continue payment           |
  | Under review     | "Your payment is being checked. You'll get an SMS when your access is ready." | Back to dashboard          |
  | Expired          | "Your access ended on 30 Nov 2026. Contact us to renew."                      | Renew access               |
  | Cancelled        | "This enrolment was cancelled."                                               | Contact us                 |

- **Payment queue** cards show the comparison at a glance (✓ Matches / ⚠ Amount differs). Tapping the receipt opens it full size. Confirming shows a toast with **Undo** for 5 seconds before it commits.
- **Enrolments (admin):** pick a course or a student to get a table of status, dates and progress. Actions in `⋯`: Extend, Renew, Cancel (reason required) (FR-ADMIN-006/008).

---

## Backend

### Endpoints (`/api/v1`)

| Area               | Endpoints                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Enrol              | `POST /courses/:id/enrol` · `POST /enrolments/:id/renew`                                                                                                                                                                                                                 |
| Payment (student)  | `GET /enrolments/:id/payment` (price + accounts) · `POST /enrolments/:id/payments` (method, reference, amount, date, receipt) · `GET /me/payments`                                                                                                                       |
| Learning           | `GET /me/dashboard` · `GET /me/courses` · `GET /learn/:slug` (outline + states + progress) · `GET /learn/lessons/:id` (access-checked render model + prev/next) · `POST /learn/lessons/:id/open` · `POST /learn/lessons/:id/complete` · `POST /learn/lessons/:id/report` |
| Announcements      | `GET /me/announcements` · `GET /me/announcements/unread-count` · `POST /me/announcements/:id/read`                                                                                                                                                                       |
| Payments (admin)   | `GET /admin/payments?status=SUBMITTED` (oldest first) · `POST /admin/payments/:id/confirm` · `POST /admin/payments/:id/reject` · `POST /admin/payments/cash`                                                                                                             |
| Enrolments (admin) | `GET /admin/enrolments?courseId=&studentId=` · `POST /admin/enrolments` · `POST /admin/enrolments/:id/extend` · `…/renew` · `…/cancel`                                                                                                                                   |
| Settings           | CRUD `/admin/payment-accounts` (+ reorder, active toggle)                                                                                                                                                                                                                |

### Rules to implement

- [ ] **One state machine service** for enrolments (ARCHITECTURE §6). Every transition writes an `EnrolmentEvent` and an `AuditLog` row
- [ ] Registration alone gives no access to any course (FR-ENR-004). Phone verification was removed by change request CR-1, so enrolling needs only a signed-in account
- [ ] One open enrolment per student and course (partial unique index). Repeated taps are idempotent
- [ ] Access dates: `startAt` is set on activation, `endAt = startAt + accessDays` (null = unlimited). Extend adds days to `endAt`. Renew starts a new period from today
- [ ] **`canOpenLesson` runs on every lesson, file, video (and in M6, quiz) request**, including direct links, and returns the reason code (FR-ENR-005/006, BR-ROLE-003)
- [ ] Payment reference normalised (trim, uppercase, no spaces) and unique among SUBMITTED/CONFIRMED (FR-PAY-003). Duplicates get the SRS §10 message
- [ ] Receipts are private files. **Only an admin confirmation opens access** (FR-PAY-006). No card numbers, PINs or passwords are stored, and the form doesn't ask for them (FR-PAY-009)
- [ ] Confirm and reject are atomic (`UPDATE … WHERE status = 'SUBMITTED'`), so two admins can't both act. Confirm → ACTIVE + SMS. Reject → reason required, AWAITING_PAYMENT, the 7-day timer restarts (Q5), SMS with the reason (FR-PAY-005)
- [ ] Cash: creates a CONFIRMED payment and activates immediately, creating the enrolment if needed (FR-PAY-007)
- [ ] Renewal: free → ACTIVE now. Paid → a RENEWAL payment while the enrolment stays EXPIRED, and confirming makes it ACTIVE with a new period
- [ ] Progress = ⌊completed published lessons ÷ published lessons × 100⌋ (FR-LEARN-004), stored on the enrolment, recalculated on complete/publish/hide
- [ ] Last lesson per course is saved on open (FR-LEARN-005). "Continue learning" on the dashboard uses the most recently opened course (FR-STU-001)
- [ ] COMPLETED enrolments are read-only: lessons open, but "Mark as complete" is hidden
- [ ] **Jobs:** `enrolment.cancelUnpaid` (7 days), `enrolment.expire`, `enrolment.remindExpiry` (3 days before, once) (ARCHITECTURE §11)
- [ ] Results and progress are never deleted on any status change (FR-ENR-009)
- [ ] "Report a problem" creates an `InboxMessage` of type PROBLEM_REPORT with the lesson link, so it shows in Admin › Messages (FR-LEARN-012)
- [ ] Media load failure in `LessonView` shows "This can't load right now. Try again or report a problem." with both actions (FR-LEARN-012)

---

## Tests

- **State machine:** every allowed transition works and every other transition is refused (table-driven unit tests)
- **AT-04:** free enrol → ACTIVE → appears on the dashboard
- **AT-05:** paid → reference submitted → lesson still blocked → admin confirms → opens + SMS queued
- **AT-06:** reject with reason → student sees it → resubmit · duplicate reference refused · cash activates instantly
- **AT-07:** without access, lesson, file and video by direct URL → refused with the correct reason
- **AT-08:** student A requesting B's enrolment, payment, receipt or progress by changing IDs → 404/403
- **AT-09:** mark complete → progress correct (including after a lesson is hidden) · "Continue learning" opens the last lesson
- **Jobs** (fake clock): unpaid cancelled at 7 days · expired at end date · reminder sent once, 3 days before
- **Concurrency:** two simultaneous confirms → exactly one succeeds

## Demo & sign-off

- [ ] As a new student on a phone: enrol in the **free** course → lesson 1 opens → mark complete → progress moves → leave and come back → "Continue learning" returns you to the same lesson
- [ ] Choose the **paid** course → copy the account number → submit a reference with a receipt photo → the dashboard shows "Payment under review" → the lesson link is blocked with a clear message
- [ ] As admin: the queue shows the payment with ✓ Matches → Confirm → the student's SMS appears in the dev inbox → the course opens
- [ ] Reject a second payment with a reason → the student sees the reason and resubmits. A duplicate reference is refused
- [ ] Record a cash payment for a walk-in student → instant access
- [ ] Admin extends, cancels (with reason) and renews an enrolment. The student's dashboard reflects each change
- [ ] Student announcement feed with unread dot. Report a problem → it appears in Admin › Messages

**Your confirmation:** ☐ Approved, go to M6 · ☐ Changes needed: ________

---

## Delivered (build notes)

- **One state machine** (`EnrolmentMachine`): the only place an enrolment's status changes. Every move is checked against the table, applies only if the enrolment is still in the status the caller saw (so two admins, or a student and a job, can never both win), and writes an `EnrolmentEvent` plus an activity-log row. Two moves go slightly beyond the SRS table so real situations never dead-end: an admin can take cash for a student who has not sent a reference yet, and can cancel an enrolment that is under review or expired.
- **Enrol:** `POST /courses/:id/enrol` is idempotent (three taps at once make one enrolment). Free courses open at once. Paid ones wait for payment. Registering alone opens nothing.
- **Pay:** `/pay/[enrolmentId]` shows the amount, the accounts with Copy buttons, and a short form. The receipt photo is shrunk on the phone before upload and re-encoded on the server. PDFs are accepted too. References are normalised (spaces and case ignored) and a reference already submitted or confirmed is refused. Receipts are private: only the student who sent it and admins can open one.
- **Payment queue** (`/admin/payments`): oldest first, expected and entered amounts side by side with ✓ Matches / ⚠ Amount differs, receipt link, Confirm (with a 5-second Undo before anything is sent) and Reject (reason required, sent to the student by SMS). Confirm and reject are atomic, so two admins cannot both act. Cash is recorded from a dialog on the same page.
- **Enrolments** (`/admin/enrolments`): filter by course, status or student; Enrol student, Extend, Renew and Cancel (reason required). Results and progress are kept through every change.
- **Payment accounts** (`/admin/settings/payments`): add, edit, hide, reorder and remove the accounts students see. Local seed adds two sample accounts, marked "(sample)".
- **Student area:** Home (Continue learning, courses, news), My courses (Active · Completed · Other), the course outline (units fold open, ✓ / ● / ○), the lesson page (progress bar on top; Previous · Mark as complete · Next in a sticky bar; Contents panel; Report a problem), Payment history (`/profile/payments`) and the News feed with unread markers. The course button on the website shows the right step for every state in the table above.
- **Access:** every lesson, file and video request still goes through `AccessPolicy`. A blocked screen always says why and offers the one next step (enrol, finish payment, back to dashboard, renew, contact us).
- **Progress** = completed published lessons ÷ published lessons, rounded down, recalculated on every completion and after a lesson is published, hidden or removed (`progress.recalc` now has its processor). Finishing every lesson completes the course unless it has a published final quiz (M6 adds that path). A finished course stays open to read.
- **Jobs** (East Africa Time): `enrolment.cancelUnpaid` hourly, `enrolment.expire` daily 00:05, `enrolment.remindExpiry` daily 09:00 (one SMS, 3 days before the end, never repeated). A rejection restarts the 7-day timer. The jobs take the current time as a parameter, so the tests move the clock.
- **Worker process:** a test now builds the standalone worker, which found (and fixed) a missing module that would have stopped it from starting in production.
- **Tests:** all 116 API integration tests and 74 unit tests pass, and the full browser suite passes (295 passed, 33 skipped by design, 0 failed). New in M5: 26 API integration tests (AT-04 … AT-09, jobs with a moved clock, two simultaneous confirms, one student reaching another's records), the transition table as unit tests, and 11 browser tests run on all four screen sizes (the admin ones on desktop only): free journey, paid journey, reject and resubmit, direct links, admin queue with Undo, cash, enrolments, payment accounts, "Report a problem", screen fit and accessibility on phones).
- **Open:** SMS gateway (Q2): messages go to the development inbox until a gateway account exists. Natik's real payment accounts must be added in Admin › Settings before launch. Quiz-based completion and certificates arrive in M6.
