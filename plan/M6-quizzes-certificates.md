# M6: Quizzes, Marking & Certificates

|                |                |
| -------------- | -------------- |
| **Status**     | 🔍 Waiting for your sign-off |
| **Depends on** | M5 confirmed   |
| **Unlocks**    | M7             |
| **Size**       | Large          |

## Goal

Teachers create quizzes. Students take them with autosave and fair, server-kept timing. Short answers get marked by teachers. Finishing a course issues a certificate anyone can verify.

## Scope

**In:** quiz builder (4 question types, settings, preview), quiz taking (intro, one question per screen, autosave, offline queue, server timer, review, submit), automatic marking, results and attempt history, the teacher marking queue, extra attempts, lesson completion through quizzes, course completion, certificate PDF, certificate list, the public verify page, certificate cancellation, the signatory setting.
**Out:** question banks, random questions and other question types (roadmap, SRS §13).

## SRS covered

FR-QUIZ-001…012 · FR-TEACH-005 · FR-LEARN-003 (quiz rule) · FR-STU-003 (results + certificates) · FR-CERT-001…005 · FR-REP-003 (mark changes, certificate cancellations) · D6 · AT-07 (quiz part), AT-10, AT-11, AT-13

---

## Question types

| Type                 | Teacher enters                                       | Marking                                                |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Multiple choice      | 2–6 options, one correct                             | Automatic                                              |
| True / False         | The correct value                                    | Automatic                                              |
| Fill in the blank    | One or more accepted answers                         | Automatic: case, extra spaces and Unicode form ignored |
| Short written answer | (optional model answer, visible to the teacher only) | Teacher marks                                          |

Every question has text, an optional image or audio, marks (default 1) and an optional explanation (FR-QUIZ-002).

---

## Screens

| Route                                               | Screen                                       | Primary action     |
| --------------------------------------------------- | -------------------------------------------- | ------------------ |
| Lesson editor → Quiz card                           | Add/edit the lesson's quiz                   | Add quiz           |
| `/teach/quizzes/[id]`                               | Quiz builder: questions + settings           | Publish            |
| `/teach/quizzes/[id]/preview`                       | Take it as a student would (nothing saved)   |                    |
| `/learn/[slug]/quiz/[quizId]`                       | Intro → questions → review → result          | Start quiz         |
| `/learn/[slug]/quiz/[quizId]/attempts`              | My past attempts and scores (FR-QUIZ-011)    |                    |
| `/teach/marking`                                    | Short answers waiting, grouped by quiz       | Start marking      |
| `/teach/courses/[id]/students/[studentId]/attempts` | A student's attempts. Give one extra attempt | Give extra attempt |
| `/certificates`                                     | My certificates                              | Download PDF       |
| `/verify`                                           | Public certificate check                     | Verify             |
| `/admin/certificates`                               | Search, view, cancel (reason)                |                    |
| `/admin/settings/certificate`                       | Signatory name, title, signature image       | Save               |

```
Quiz builder (desktop; settings drop below on mobile)
┌──────────────────────────────────────────────────────────────────────┐
│ ← Short vowels · Lesson quiz                 (Draft) [Preview][Publish]│
├────────────────────────────────────────────────┬─────────────────────┤
│ Questions (4)                                  │ Settings            │
│ ┌────────────────────────────────────────────┐ │ Final quiz     [ ]  │
│ │ ⠿ 1 · Multiple choice · 1 mark        ⋯   │ │ Pass mark  [60]%    │
│ │   Which letter is "ta"?                    │ │ Attempts  [Unlimited▾]│
│ │ ⠿ 2 · True / False · 1 mark           ⋯   │ │ Time limit [None ▾] │
│ │ ⠿ 3 · Fill in the blank · 1 mark      ⋯   │ │ Show answers after  │
│ │ ⠿ 4 · Short answer · 2 marks          ⋯   │ │ submitting    [✓]   │
│ └────────────────────────────────────────────┘ │                     │
│ [+ Add question]                               │ Total: 5 marks      │
└────────────────────────────────────────────────┴─────────────────────┘
+ Add question → 4 big tiles: (◉ Multiple choice) (✓✗ True/False) (▁ Fill blank) (✎ Short answer)
```

```
Taking a quiz (mobile)
  Intro                          Question                        Review
┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│ Short vowels quiz     │   │ 3 of 10      ⏱ 12:41  │   │ Ready to submit?      │
│                       │   │ ●●●○○○○○○○             │   │ 9 of 10 answered      │
│ 10 questions          │   ├───────────────────────┤   │ ○ Question 7 skipped  │
│ 15 minutes            │   │ Which letter is "ta"? │   │   [Go to question 7]  │
│ Pass mark 60%         │   │                       │   │                       │
│ Attempts left: 2 of 2 │   │ ( )  ب                │   │ [   Submit answers  ] │
│                       │   │ (•)  ت                │   │ Back to questions     │
│ [    Start quiz     ] │   │ ( )  ث                │   └───────────────────────┘
└───────────────────────┘   │              Saved ✓  │
                            ├───────────────────────┤
                            │ [‹ Back]    [Next ›]  │
                            └───────────────────────┘
```

```
Result (passed)                  Waiting for marking             Not passed
┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│       ╭──────╮        │   │     (hourglass)       │   │       ╭──────╮        │
│       │ 80%  │ gold   │   │ Waiting for teacher   │   │       │ 45%  │ navy   │
│       ╰──────╯        │   │ marking               │   │       ╰──────╯        │
│     You passed!       │   │ We'll show your score │   │  Not passed this time │
│ 8/10 · Pass mark 60%  │   │ here once it's marked.│   │ Pass mark 60% · 1 left│
│ [ Review answers ]    │   │ [ Continue course ]   │   │ [  Try again  ]       │
│ [ Next lesson → ]     │   └───────────────────────┘   │ Review answers        │
└───────────────────────┘                               └───────────────────────┘
```

```
Marking (teacher, mobile-friendly)               Verify (public)
┌──────────────────────────────────────┐   ┌───────────────────────────────┐
│ To mark (7)    Course ▾   Quiz ▾     │   │ Verify a certificate          │
├──────────────────────────────────────┤   │ [NLC-2026-00042   ] [Verify]  │
│ Unit 2 quiz · Q4 · 2 marks           │   ├───────────────────────────────┤
│ Write a sentence using "kitaab".     │   │ ✓ Valid certificate           │
│ ┌──────────────────────────────────┐ │   │ Abdi Kedir                    │
│ │ هذا كتابٌ جميلٌ                   │ │   │ Arabic for Beginners          │
│ └──────────────────────────────────┘ │   │ Completed 12 Dec 2026         │
│ Score  [ 2 ] / 2                     │   └───────────────────────────────┘
│ Comment (optional) [ Excellent!    ] │    Not found → "We couldn't find this number."
│ [ Skip ]            [ Save & next ]  │    Cancelled → "This certificate was cancelled."
└──────────────────────────────────────┘
```

```
Certificate (A4 landscape PDF)
┌──────────────────────────────────────────────────────────────┐
│ ║                        [ logo ]                          ║ │
│ ║               CERTIFICATE OF COMPLETION                  ║ │
│ ║                   ─────── ✦ ───────  (gold)              ║ │
│ ║                      Abdi Kedir                          ║ │
│ ║            has successfully completed the course         ║ │
│ ║                  Arabic for Beginners                    ║ │
│ ║                                                          ║ │
│ ║  12 Dec 2026          [signature]            [QR code]   ║ │
│ ║  Date                 Name, Title            NLC-2026-00042║
│ ║          Verify at natik…/verify                         ║ │
└──────────────────────────────────────────────────────────────┘
Navy double border, gold accents, off-white background.
```

### UX details

- **One question per screen** on phones, with a dot navigator. On desktop a question list sits on the side. Fewer things on screen means less stress.
- **Autosave is quiet:** "Saving…" → "Saved ✓" under the answer. Offline, answers queue on the device, a slim banner shows the SRS message, and they sync on reconnect (FR-QUIZ-006).
- **Timer chip** counts down from the server's deadline. It turns gold-tinted with 1 minute left and gives a screen-reader announcement at 5 min and 1 min. At 0 it shows "Time is up. Your saved answers were submitted."
- **Review screen** lists unanswered questions before submitting, so nothing is skipped by accident.
- **Result first, details on demand.** Big score ring, then pass/fail, then "Review answers" (correct answers and explanations only if the teacher allowed it).
- **Arabic quizzes:** question, options and the fill-in field use `dir="rtl"` and the Naskh font.
- **Course complete moment:** a gold confirmation screen ("Course complete! Your certificate is ready.") with [Download certificate].
- **Marking** keeps the teacher in flow: one answer at a time, "Save & next", and the score field accepts 0 to max marks in 0.5 steps.

---

## Backend

### Endpoints (`/api/v1`)

| Area         | Endpoints                                                                                                                                                                                                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder      | `POST /teach/lessons/:id/quiz` · `GET/PATCH /teach/quizzes/:id` · publish/hide · CRUD `/teach/quizzes/:id/questions` (+ reorder) · `GET /teach/quizzes/:id/preview`                                                                                                                                                                 |
| Taking       | `GET /learn/quizzes/:id` (intro: counts, limits, attempts left) · `POST /learn/quizzes/:id/attempts` (start) · `GET /learn/attempts/:id` (questions **without answers**) · `PUT /learn/attempts/:id/answers/:questionId` · `POST /learn/attempts/:id/submit` · `GET /learn/attempts/:id/result` · `GET /learn/quizzes/:id/attempts` |
| Marking      | `GET /teach/marking` (queue + counts) · `POST /teach/answers/:id/mark` (score, comment) · `POST /teach/quizzes/:id/grants` (student, +1 attempt)                                                                                                                                                                                    |
| Certificates | `GET /me/certificates` · `GET /me/certificates/:id/pdf` · `GET /public/certificates/:number` · `GET /admin/certificates` · `POST /admin/certificates/:id/cancel` · `GET/PUT /admin/settings/certificate`                                                                                                                            |

### Rules to implement

- [ ] One quiz per lesson. **One final quiz per course** (partial unique index) (FR-QUIZ-001)
- [ ] Defaults: final quiz pass 70%, 2 attempts. Lesson quiz pass 60%, unlimited attempts. Time limit optional. Show answers on/off (FR-QUIZ-003)
- [ ] **Correct answers and explanations are never sent before submit.** The student question DTO is an allow-list (FR-QUIZ-010)
- [ ] Starting an attempt checks: access (`canOpenLesson`), quiz published, attempts left (max + grants), no other attempt in progress (resume instead)
- [ ] A question snapshot is saved on start, so later edits don't change in-progress or past attempts (FR-TEACH-008)
- [ ] Server timer: `deadlineAt` set on start. Saves after the deadline are refused. `quiz.autoSubmit` job + a check on every request submit expired attempts (FR-QUIZ-007)
- [ ] Answer saves are idempotent (`PUT` per question), so client retries are safe
- [ ] Auto-marking: multiple choice by option ID, true/false by value, fill-in after NFC normalisation, trimming, collapsing spaces and ignoring case
- [ ] Status: all automatic → GRADED. Any short answer → WAITING_FOR_MARKING until every short answer is marked → GRADED (FR-QUIZ-009)
- [ ] Score % = marks awarded ÷ total marks × 100. Passed = score % ≥ pass mark
- [ ] **Completion cascade** (works in any order):
  - lesson quiz passed → lesson complete → progress updated (FR-LEARN-003)
  - all published lessons complete **and** final quiz passed → enrolment COMPLETED → `certificate.render` queued (FR-CERT-001, D6)
- [ ] Re-marking is allowed and logged as `MARK_CHANGED` with old → new. Issued certificates are never auto-revoked; that is an admin decision
- [ ] Certificate number `NLC-YYYY-NNNNN` from a per-year counter, locked inside a transaction (FR-CERT-002)
- [ ] PDF: HTML template → headless Chromium in the worker, with fonts embedded (Montserrat, Noto Naskh Arabic, Noto Sans Ethiopic for names) and a QR code to `/verify?n=…`. Stored privately, downloaded through a signed URL (FR-CERT-003)
- [ ] Verify returns **only** name, course, date and status. Rate-limited to stop enumeration (FR-CERT-004)
- [ ] Cancel needs a reason, is logged (`CERTIFICATE_CANCELLED`), and verify then shows "cancelled" (FR-CERT-005)
- [ ] Teachers only mark answers from their assigned courses. Admins can mark any (FR-ADMIN-005)

---

## Tests

- **AT-10:** all 4 types mark correctly · attempt limits enforced (incl. +1 grant) · timer enforced on the server · go offline mid-quiz, answer, reconnect → answers saved
- **AT-11:** a short answer waits → the teacher marks it → the student sees score and comment
- **AT-13:** finish every lesson + pass the final → COMPLETED + certificate → verify shows it valid → cancel → verify shows cancelled
- **AT-07 (quiz):** start or read an attempt without access by direct URL → refused
- **Security:** no `correct`/`explanation` field appears in any student payload before submit (schema snapshot test) · a student can't read another student's attempt (IDOR)
- **Edge cases:** final passed before the last lesson is done → completes when the last lesson is done · hiding a lesson changes progress but keeps results · two certificates issued at once get distinct sequential numbers

## Demo & sign-off

- [ ] Teacher builds a lesson quiz with all 4 types and a 5-minute final quiz, then previews both
- [ ] Student on a phone takes the lesson quiz. Turn Wi-Fi off mid-quiz → banner → back on → answers saved → submit → result
- [ ] Final quiz with a short answer → "Waiting for marking" → teacher marks in the queue → student passes
- [ ] Course completes → gold moment → download the certificate PDF (check the Arabic/Ethiopic name rendering)
- [ ] Verify the number on the public page. Admin cancels it, and verify shows "cancelled"
- [ ] Let the timer run out on a timed attempt → saved answers are auto-submitted
- [ ] Teacher gives a student one extra attempt on the final quiz

**Your confirmation:** ☐ Approved, go to M7 · ☐ Changes needed: ________

---

## Delivered (build notes)

- **Quiz builder** (`/teach/quizzes/[id]`, from the lesson editor's Quiz card): the four question types (multiple choice, true/false, fill in the blank, short answer), marks in halves, an optional picture and explanation per question, reorder, edit, remove. Settings: final quiz, pass mark, attempts, time limit, show answers. A final quiz starts at 70% and 2 attempts, a lesson quiz at 60% and unlimited. A course has one final quiz; a lesson has one quiz. A quiz that students have taken can only be hidden, so their results are kept. Questions can still be edited after publishing: students who already started keep the version they began with (the questions are copied when an attempt starts).
- **Preview** (`/teach/quizzes/[id]/preview`): the same screens a student gets. Nothing is saved or marked.
- **Taking a quiz** (`/learn/[slug]/quiz/[quizId]`): intro → one question per screen with a numbered navigator → review of unanswered questions → submit → result, on one address. Answers save as they are given ("Saving… / Saved ✓"). If the connection drops, a banner appears, answers wait on the phone (also across a reload) and are sent when it is back. The timer counts down from the **server's** deadline; late saves are refused and a minute-by-minute job submits attempts nobody came back to (`quiz.autoSubmit`). Starting again resumes an attempt in progress.
- **Privacy:** before submitting, a student's payload is an allow-list with no answers and no explanations (a test checks this on every response). Correct answers and explanations come back only if the teacher allowed them. Another student's attempt answers "not found".
- **Marking:** three types are marked at once (fill-in ignores capital letters, extra spaces and Unicode form; a blank short answer is zero with no teacher needed). Short answers wait in **Marking** (`/teach/marking`): one at a time, "Save & next", filter by course and quiz, model answer for the teacher. A teacher sees only their own courses; admins see all. Changing a mark later recalculates the score and is logged old → new (`MARK_CHANGED`). The menu shows how many answers are waiting.
- **Results and attempts:** result screen with a ring (gold when passed), "Waiting for teacher marking" while a short answer is unmarked, a review of every answer with the teacher's comment, and "My attempts" (`/learn/[slug]/quiz/[quizId]/attempts`). **Extra attempts:** a teacher gives one more try from the course's **Students** page (`/teach/courses/[id]/students/[studentId]`).
- **Completion:** passing a lesson quiz completes that lesson. A course completes when every published lesson is done **and** the published final quiz is passed, in either order. Hiding or removing a final quiz re-checks the students who were only waiting for it. The dashboard shows recent results and certificates.
- **Certificates:** one per completed course, numbered `NLC-YYYY-NNNNN` from a per-year counter locked inside a transaction (two at once never share a number). The PDF (A4 landscape, navy double border, gold accents, QR code to `/verify?n=…`) is printed by a headless Chromium with Montserrat, Noto Naskh Arabic and Noto Sans Ethiopic embedded, so Arabic and Ethiopic names render correctly. It is stored privately and downloaded through the API. `/certificates` lists them; the verify page now checks a scanned QR code straight away. If the worker has not issued one yet, opening the list issues it (self-healing).
- **Admin:** `/admin/certificates` (search by number, name or course; open the PDF; cancel with a reason, logged as `CERTIFICATE_CANCELLED`, after which the verify page says "cancelled") and `/admin/settings/certificate` (signatory name, title and signature picture, used on new certificates; issued ones keep what was printed).
- **Tests:** 21 new API integration tests (AT-10, AT-11, AT-13, AT-07 quiz part, privacy, edge cases such as "final passed first" and simultaneous certificates, including a real PDF), 9 new unit tests for the marking rules, and 8 browser tests: build and preview a quiz, a full phone journey (answer, wait for marking, pass, course complete, certificate PDF, verify, cancel), offline answers, a timed attempt that runs out, and the marking and certificate admin screens.
- **Deploy note:** the API image now installs Chromium (`apk add chromium`, `CHROMIUM_PATH`) so the worker can print certificates.
- **Open:** question pictures are supported; question **audio** is not yet (roadmap). Real signatory name and signature are needed from Natik before launch. The certificate text is English only.
