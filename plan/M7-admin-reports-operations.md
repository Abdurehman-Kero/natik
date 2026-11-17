# M7: Admin Dashboard, Reports & Operations

|                |                |
| -------------- | -------------- |
| **Status**     | 🔍 Waiting for your sign-off |
| **Depends on** | M6 confirmed   |
| **Unlocks**    | M8             |
| **Size**       | Medium         |

## Goal

Admins see the centre at a glance, export reports, and can trace who did what. Teachers see and export their students' progress. The platform cleans up after itself according to the data-keeping rules.

## Scope

**In:** admin dashboard, the 4 reports with CSV export, the activity log viewer, the final teacher dashboard, teacher student-progress view + CSV, the settings hub (pulls together earlier settings + SMS failures + admin/owner management), data-keeping jobs, the account deletion request flow, a final pass over every role's navigation.
**Out:** detailed analytics and charts beyond the simple bars below (roadmap).

## SRS covered

FR-ADMIN-001 · FR-REP-001…004 · FR-TEACH-001 (complete), FR-TEACH-006 · FR-NOTIF-004 (admin view) · BR-ROLE-002 (in exports) · BR-ROLE-004 (UI) · SRS §8.2 · AT-14

---

## Screens

| Route                          | Screen                                                          | Primary action         |
| ------------------------------ | --------------------------------------------------------------- | ---------------------- |
| `/admin`                       | Dashboard                                                       | (cards link to queues) |
| `/admin/reports`               | Tabs: Registrations · Enrolments · Payments · Progress & scores | Export CSV             |
| `/admin/activity`              | Activity log (read-only)                                        |                        |
| `/admin/settings`              | Settings hub                                                    |                        |
| `/teach`                       | Teacher dashboard (final)                                       | Start marking          |
| `/teach/courses/[id]/students` | Student progress table                                          | Export CSV             |

```
Admin dashboard (desktop; cards stack 2×2 on mobile)
┌──────────────────────────────────────────────────────────────────────┐
│ Good morning, Hana                                    Tue 4 Nov 2026 │
├──────────────┬──────────────┬──────────────────┬─────────────────────┤
│ 1,248        │ +36          │ 5                │ 3                   │
│ Students     │ New this week│ Payments to check│ New messages        │
│              │              │ Review now →     │ Open inbox →        │
│              │              │  (gold edge)     │                     │
├──────────────┴──────────────┴──────────────────┴─────────────────────┤
│ ▬ Active enrolments by course                                        │
│ Arabic for Beginners   ████████████████████  212                     │
│ English B1             ████████████          130                     │
│ Afaan Oromo Basics     ██████                 74                     │
├──────────────────────────────────────────────────────────────────────┤
│ Quick actions:  [Record cash payment] [New course] [Post announcement]│
└──────────────────────────────────────────────────────────────────────┘
The "Payments to check" card gets a gold edge when the count is above 0, and is calm at 0.
```

```
Reports (desktop)
┌──────────────────────────────────────────────────────────────────────┐
│ Reports                                                [Export CSV]  │
│ Registrations · Enrolments · Payments · Progress & scores            │
│ Date: [This month ▾]   Course: [All courses ▾]                       │
├──────────────────────────────────────────────────────────────────────┤
│ Total confirmed: ETB 186,000 · 124 payments                          │
├──────────────────────────────────────────────────────────────────────┤
│ Date        Student        Course          Method    Amount   By     │
│ 3 Nov 2026  Abdi Kedir     Arabic Beg.     telebirr  1,500    Hana   │
│ 3 Nov 2026  Sara Ali       English B1      Cash      1,200    Hana   │
│ 2 Nov 2026  Musa Bekele    Oromo Basics    Bank      —        Hana   │
└──────────────────────────────────────────────────────────────────────┘
```

```
Activity log                                       Teacher › Students (mobile cards)
┌──────────────────────────────────────────────┐   ┌─────────────────────────────┐
│ Activity log                                 │   │ Arabic for Beginners        │
│ Action: All ▾  User: All ▾  Date: 7 days ▾   │   │ 212 students   [Export CSV] │
├──────────────────────────────────────────────┤   │ [Search name…            ]  │
│ 10:42  Hana T.   Confirmed payment           │   ├─────────────────────────────┤
│        Abdi Kedir · Arabic Beg.          ›   │   │ Abdi Kedir                  │
│ 10:15  Ustaz A.  Changed a mark (1 → 2)  ›   │   │ ██████░░░░ 42% · 10/24      │
│ 09:58  Hana T.   Disabled account        ›   │   │ Quiz avg 78% · Final —      │
│ 09:30  Sara M.   Signed in                   │   │ Last active 2 days ago      │
└──────────────────────────────────────────────┘   └─────────────────────────────┘
 › opens a details drawer (before → after, reason)   No phone numbers, ever (BR-ROLE-002)
```

```
Settings hub
┌──────────────────────────────────────────────────────────────┐
│ Settings                                                     │
│ ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐ │
│ │ Payment accounts │ │ Languages &      │ │ Certificate    │ │
│ │ 3 accounts    →  │ │ levels        →  │ │ signatory   →  │ │
│ └──────────────────┘ └──────────────────┘ └────────────────┘ │
│ ┌──────────────────┐ ┌──────────────────┐                    │
│ │ SMS delivery     │ │ Admins & owner   │                    │
│ │ ⚠ 2 failed    →  │ │ 3 admins      →  │                    │
│ └──────────────────┘ └──────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

### UX details

- **The dashboard answers "what needs me today?"** Queue cards (payments, messages) link straight to the work.
- **Reports:** one filter row (date presets: This week, This month, Last 30 days, Custom; course), a one-line summary, then the table. Missing values show "—" (FR-REP-002).
- **The CSV opens cleanly in Excel**, Arabic names included (AT-14).
- **Activity log** is read-only, with no edit or delete controls anywhere. A details drawer shows before → after and the reason.
- **SMS delivery:** a list of failed messages (masked phone, template, error, time) with [Retry] (FR-NOTIF-004).
- **Admins & owner:** visible to all admins, editable only by the Owner. The last Owner shows a lock icon with the tooltip "At least one owner is required" (BR-ROLE-004).
- **Account deletion request:** in Admin › User › ⋯ › "Delete personal data". A `ConfirmDialog` asks for a reason and explains in one line what is kept (results anonymised, certificates verifiable, Q9).

---

## Backend

### Endpoints (`/api/v1`)

| Area      | Endpoints                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Dashboard | `GET /admin/dashboard` (cached 60 s) · `GET /teach/dashboard`                                           |
| Reports   | `GET /admin/reports/:type?from=&to=&courseId=&page=` · `GET /admin/reports/:type.csv?…` (streamed)      |
| Activity  | `GET /admin/activity?action=&actorId=&from=&to=&page=` · `GET /admin/activity/:id`                      |
| Teacher   | `GET /teach/courses/:id/students?q=&page=` · `GET /teach/courses/:id/students.csv`                      |
| SMS       | `GET /admin/sms?status=FAILED` · `POST /admin/sms/:id/retry`                                            |
| Admins    | `GET /admin/admins` · `POST /admin/admins` (Owner) · `PATCH /admin/admins/:id` (Owner: role/owner flag) |
| Data      | `POST /admin/users/:id/erase` (reason)                                                                  |

### Rules to implement

- [ ] Dashboard figures (FR-ADMIN-001): total students · registrations in the last 7 days (EAT week) · SUBMITTED payments · ACTIVE enrolments per course · NEW contact messages
- [ ] Reports (FR-REP-001), filtered by date and course:
  - **Registrations:** date, name, masked phone, interested language, verified yes/no
  - **Enrolments:** student, course, status, start, end, progress %
  - **Confirmed payments:** date, student, course, method, reference, amount, checked by. Totals per method
  - **Progress & scores:** student, course, progress %, lessons done, average quiz %, final quiz %, completed date
- [ ] Report numbers are computed with SQL (views/CTEs) and **match a hand count** of the seeded fixtures (AT-14)
- [ ] **CSV export:** UTF-8 **with BOM** (Excel shows Arabic correctly), CRLF line endings, RFC-4180 quoting, cells starting with `= + - @` prefixed with `'` (formula-injection safe), dates as `YYYY-MM-DD`, money in ETB with 2 decimals, blanks as "—"
- [ ] Teacher progress (FR-TEACH-006): only students of their assigned courses, **no phone, no payments** (BR-ROLE-002), in both the screen and the CSV
- [ ] Teacher dashboard (FR-TEACH-001): my courses + student counts + "To mark" count
- [ ] Activity log viewer (FR-REP-004): read-only, paged, filterable. Confirm that every FR-REP-003 action is being recorded:
      sign-ins · role changes · account disable/enable · enrolment changes · payment decisions · mark changes · certificate cancellations
- [ ] **Data-keeping jobs** (SRS §8.2, `retention.cleanup`):
  - unverified accounts with no activity for 30 days → deleted
  - 3 years after last activity → personal details removed (name → "Former student", phone/email/photo cleared). Results kept in anonymised form. Certificate records keep the snapshot name (Q9)
  - payment records kept (tax rules, to be confirmed by Natik's accountant)
- [ ] Deletion on request: anonymises the same way as above, revokes sessions, logs `ACCOUNT_ERASED`. Admins handle it within 30 days (SRS §8.2)
- [ ] Final navigation review: every role's sidebar/tabs match DESIGN.md §8, badges show correct counts, there are no dead links

---

## Tests

- **AT-14:** each report total equals a manual count over fixed seed data · the CSV opens in Excel with correct Arabic · the activity log lists every required action type
- The teacher CSV contains no phone or payment columns (header snapshot test)
- CSV injection: a student named `=HYPERLINK(…)` exports as plain text
- Retention job (fake clock): a 31-day unverified account is deleted, a 29-day one is kept · anonymisation keeps results and certificate verification working
- A non-Owner admin can't create admins · the last Owner can't be demoted (UI disabled + API 403)
- The audit table refuses UPDATE/DELETE at database level

## Demo & sign-off

- [ ] Admin dashboard on desktop and phone. Every card links to its queue
- [ ] Export each report as CSV and open it in Excel, Arabic names included. Spot-check one total by hand
- [ ] Activity log: filter by "Payment decisions" and open a row's details
- [ ] Teacher: dashboard shows "To mark", the students table and CSV export (no phone numbers)
- [ ] Settings hub: retry a failed SMS, and add an admin as the Owner
- [ ] Erase a test student's personal data. Their certificate still verifies

**Your confirmation:** ☐ Approved, go to M8 · ☐ Changes needed: ________

---

## Delivered (build notes)

- **Admin dashboard** (`/admin`): total students, new this week, **payments to check** and **new messages** (both with a gold edge when above zero and a link straight to the queue), active enrolments by course as simple bars, and quick actions. The figures are counted fresh once a minute, not on every page view.
- **Reports** (`/admin/reports`): Registrations, Enrolments, Payments (confirmed only, with totals per method) and Progress & scores. One filter row (All time, This week, This month, Last 30 days or custom dates, and course), a one-line summary, a table that scrolls sideways on a phone, and paging. Dates run midnight to midnight in East Africa Time. Phone numbers are masked in every report. Missing values show "—", never zero.
- **CSV export:** UTF-8 with a byte-order mark (Excel shows Arabic and Ethiopic names correctly), CRLF line endings, proper quoting, dates as `2026-11-04` in EAT, money as `1500.00`, and any cell starting with `=`, `+`, `-` or `@` is defused so a student named `=HYPERLINK(…)` exports as plain text. Up to 20,000 rows.
- **Activity log** (`/admin/activity`): read-only, newest first, grouped by day, filtered by kind of action (sign-ins, accounts and roles, enrolments, payment decisions, marks, certificates, courses and quizzes), person and dates. Tapping a row shows who, when, what it was about and the recorded details (for example a changed mark, old → new). Every action the SRS requires is recorded, and a test checks that none of them falls into "Other". The database itself refuses to change or delete these rows.
- **Teacher home** (`/teach`): number of courses and students and how many answers wait for marking, with a Start marking button. **Students** page (`/teach/courses/[id]/students`): name search, progress, lessons done, quiz average, final quiz score, last active, and **Export CSV**. Teachers never see phone numbers or payments, on screen or in the file (a test checks the file header and content). This also removed the phone number the earlier simple students list showed.
- **Settings hub:** payment accounts (with a count), languages and levels, certificate signatory, **SMS delivery** (a warning count when messages failed; `/admin/settings/sms` lists them with a masked number, the error and **Retry**), **Admins and owner** (opens the user list filtered to admins, where only the Owner can create or change admins and the last Owner is protected, as built in M2), reports and the activity log.
- **Delete personal data** (Admin › Users › ⋯): asks for a reason and says what stays. The person's name, phone, email and photo are removed, they are signed out, results are kept without their name, payment records are kept, and certificates still verify with the name printed on them. It is logged as `ACCOUNT_ERASED`. Admin accounts cannot be erased this way.
- **Data-keeping job** (`retention.cleanup`, daily 02:00 EAT): accounts that were created but never used (no password set, never signed in, no enrolments) are deleted after 30 days. People with no activity for 3 years have their personal data erased the same way. Because phone-code verification was removed (change request CR-1), "never used" stands in for "unverified" so real students are never caught by the 30-day rule. The jobs take the time as a parameter, so tests move the clock.
- **Tests:** 16 new API integration tests (report totals equal a hand count per method and status, the CSV file, the teacher privacy checks, the activity log and its database guard, erasure keeping certificates valid, the clean-up with a moved clock, SMS retry), 5 CSV unit tests, and 9 browser tests (dashboard cards and settings links, each report and a real CSV download, the activity log filter and details drawer, deleting personal data through the screen, the teacher home and students export, and every new admin screen on all four screen sizes for fit and accessibility).
- **Open:** how long payment records must be kept (tax rules) still needs Natik's accountant. The activity log keeps rows indefinitely until a retention period is agreed (M8).
