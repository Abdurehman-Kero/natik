# Natik Interactive Learning Academy: Plan

|                |                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------- |
| **Status**     | 🟡 Phase A built (see "Phase A delivered" below). Phases B to D wait for your sign-off on A         |
| **Type**       | Change request **CR-2**, to be scheduled after M8, one phase at a time with your sign-off         |
| **Written**    | 10 Nov 2026                                                                                       |
| **Reads best** | Sections 1 to 3 tell you what we already have and what is missing. Sections 4 to 8 are the plan. |

---

## 1. What we already have (so we do not rebuild it)

The brief you pasted overlaps a lot with what M1 to M8 and the chat already delivered.

| Area in the brief                                                | Where it stands today                                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Courses per language, levels, units, lessons                     | ✅ Done (M3). Languages and levels are editable by admins                                            |
| Lesson content: text, video, PDF, audio, images                  | ✅ Done (M3). Video is hosted (Bunny in production, local in development) and shown on a tap        |
| Free sample lessons, free and paid courses, access control       | ✅ Done (M4, M5). Free-preview switch per lesson, enrolment, payment queue, expiry                   |
| Quizzes: multiple choice, true/false, fill in the blank          | ✅ Done (M6), plus short answer marked by a teacher                                                  |
| Timed quizzes, pass mark, attempts, automatic scoring, answers   | ✅ Done (M6). The server owns the timer; answers are explained after submitting                      |
| Lesson completion, course progress, "Continue learning"          | ✅ Done (M5, M6). Completing every lesson plus passing the final quiz earns a certificate            |
| Student dashboard: courses, progress, certificates               | ✅ Done (M5) but basic (section 2 lists what it lacks)                                               |
| Admin dashboard, reports, activity log, user management          | ✅ Done (M7)                                                                                         |
| Role-based access, protected files, progress saved in database   | ✅ Done (M2 to M6). Permission-matrix test covers every route                                        |
| Arabic right-to-left, mobile first, Natik branding               | ✅ Done. Arabic text switches direction automatically                                                |
| Certificates                                                     | ✅ Done (M6). The brief's "Phase 4: certificates" is already finished                                |
| Chat with admin and teachers, with files and voice               | ✅ Done (not in the brief, but it helps)                                                             |

So we are **not** building a new application. We extend the lesson, the dashboard and the course builder we have.

## 2. What is missing, and what we pick

These are the parts of the brief that are not in the system yet. Each is rated:
**Core** = we should build it. **Later** = useful, but after the core is live. **Dropped** = advanced, kept out (section 8).

| #   | Missing piece                                                                                         | Pick      | Phase |
| --- | ----------------------------------------------------------------------------------------------------- | --------- | ----- |
| 1   | **Structured lesson stages**: intro with objectives and study time, then prepare, watch, revise, examples, vocabulary, practice, quiz | Core      | A     |
| 2   | **Slide viewer** for preparation and revision slides (slides you build in the app, or a PDF deck)     | Core      | A     |
| 3   | **Video upgrades**: external links (YouTube, Vimeo), speed control, captions, resume where you stopped | Core      | A     |
| 4   | **Collapsible course sidebar** and a clearer lesson stepper (today: a "Contents" sheet)                | Core      | A     |
| 5   | **Lesson unlock rules** (open in order, or all open)                                                  | Core      | A     |
| 6   | **Vocabulary system**: word, English / Afaan Oromo / Arabic translation, pronunciation, audio, example sentence, save to my words | Core      | B     |
| 7   | **Examples and dialogues** block (a conversation shown line by line, with audio per line)             | Core      | B     |
| 8   | **Matching** as a quiz question type                                                                  | Core      | B     |
| 9   | **Practice activities** made from a lesson's vocabulary: flashcards, word matching, fill in the blanks, sentence building, spelling, listening | Core      | C     |
| 10  | **Real time tracking**: video watched, slides viewed, quiz time, practice time, with idle time ignored | Core      | C     |
| 11  | **Student dashboard upgrade**: learning hours, quiz history, my words, daily streak                    | Core      | C     |
| 12  | **Learning analytics for admins and teachers**: study time and where students stop                    | Core      | C     |
| 13  | **Daily word and review** (a short daily practice from the words you saved)                           | Later     | D     |
| 14  | **Achievements** (a few simple badges: first lesson, 7-day streak, course finished)                   | Later     | D     |
| 15  | **Record yourself** to compare with the teacher's pronunciation (you listen back; no scoring)         | Later     | D     |
| 16  | **PowerPoint upload** (converted to slides automatically)                                             | Later     | D     |

### Why this order

Phase A makes every lesson look like the brief (stages, slides, better video) using content teachers already know how to add.
Phase B adds the language-specific content (words, dialogues, matching). Phase C turns those words into practice and adds the numbers
(time, streaks) the dashboard needs. Phase D is polish.

---

## 3. How a lesson will look to a student

Today a lesson is a list of blocks. The new lesson is a short guided path. Stages with no content are skipped, so a simple lesson still works.

```
Mobile                                   Desktop
┌─────────────────────────┐              ┌──────────┬──────────────────────────────┐
│ ←  Greeting people   ≡  │              │ Course   │  Lesson 2 of 8       ⏱ 12 min │
│ ━━━━━━━━○───────  3 / 8 │              │ outline  │  Greeting people              │
│ Intro · Prepare · [Watch]│              │ (can     │  ○ Intro ○ Prepare ● Watch    │
│ ┌─────────────────────┐ │              │ collapse)│    ○ Revise ○ Words ○ Practice│
│ │      ▶  video       │ │              │          │  ┌────────────────────────┐   │
│ │ 1x ▾  CC  ⛶          │ │              │ ✓ L1     │  │ video   1x ▾  CC  ⛶    │   │
│ └─────────────────────┘ │              │ ▶ L2     │  └────────────────────────┘   │
│  [ Back ]     [ Next → ] │              │ 🔒 L3    │       [ Back ]  [ Next → ]    │
└─────────────────────────┘              └──────────┴──────────────────────────────┘
```

| Stage                | What the student sees                                                         | Built from                                  |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| 1. Intro             | Title, short description, learning objectives, estimated minutes              | New lesson fields                           |
| 2. Prepare           | Slides: explanations, pictures, key words                                     | Slide block (new)                           |
| 3. Watch             | Video with speed, captions, fullscreen. Resumes where they stopped            | Video block (upgraded)                      |
| 4. Revise            | Summary slides                                                                | Slide block                                 |
| 5. Examples          | Real-life examples and dialogues, with audio                                  | Dialogue block (new) and text               |
| 6. Words             | The lesson's vocabulary: translation, audio, "save to my words"               | Vocabulary list (new)                       |
| 7. Practice          | Flashcards and games made from those words                                    | Practice (new, automatic)                   |
| 8. Quiz              | The existing quiz                                                             | Quiz (M6)                                   |

A lesson counts as complete when the student has reached the end of every stage that has content and passed the quiz (if it has one). Teachers can mark a stage as "optional".

---

## Phase A delivered (11 Nov 2026)

Built with the recommended answers to the six decisions in section 9 (lessons open freely unless a course is set to
"one after another"; slides built in the app; YouTube and Vimeo links allowed with a warning in the builder).

| Planned                                                       | Status                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Lesson intro (description, goals, study time)                 | ✅ Lesson introduction card in the editor; shown as the first step                               |
| Stages and the guided path                                    | ✅ Step menu on every block; steps bar, Next step button, remembers the step                     |
| Slides built in the app                                       | ✅ Slides block with pictures and key words; swipe, arrow keys, right-to-left aware              |
| PDF deck, one page at a time                                  | ✅ Already existed (the PDF viewer reads one page at a time), so nothing new was needed           |
| Video: external links, captions, speed, resume                | ✅ YouTube and Vimeo links, WebVTT captions, speed menu, resume. Speed, captions and resume work for videos we host; the YouTube and Vimeo players use their own controls |
| Collapsible course sidebar, lock icons                        | ✅ Outline beside the lesson on large screens (fold away, remembered); locked lessons are marked |
| Lesson unlock rules                                           | ✅ Course setting "one after another", per-lesson "always open"; enforced for lessons, files, videos and quizzes |
| Public: find your level, how learning works, path by level, numbers, teachers, install, Telegram/WhatsApp join, course outline, trailer, teacher card, related courses | ✅ All built from the real database                               |
| Admin screen for the "Find your level" questions              | ⬜ **Not built yet.** The check ships with starter questions in development only; for launch an admin screen (or the language teachers) must supply and review the questions. The page hides itself while there are none |

Also worth knowing: the starter Arabic and Afaan Oromo questions were written by me and **must be reviewed by a teacher** before launch.
Time spent in a lesson is not tracked yet (that is Phase C); only the step and the video position are saved.

## 4. Phase A: Lesson stages, slides, video, sidebar, unlocking

**Goal:** lessons follow the guided path, slides and better video work, and lessons can open in order.

**Teacher and admin side (course builder)**
- Lesson settings gain: description, learning objectives (a short list), estimated minutes.
- Each block belongs to a **stage** (Prepare, Watch, Revise, Examples, Words, Practice). A "New lesson" button offers a template that creates the stages for them.
- **Slide block:** a deck built in the page. Each slide has a title, text, an optional picture, and an optional list of key words. Reorder by dragging. Also allows a **PDF deck** (shown one page at a time).
- **Video block:** three sources: upload (existing), **external link** (YouTube or Vimeo, shown with privacy-friendly embeds), and a **captions file** (.vtt) per video. Speed control comes with the player; for our own videos we add a speed menu (0.75x, 1x, 1.25x, 1.5x, 2x).
- **Course setting:** "Lessons open: all at once / in order." In order means lesson N opens when lesson N-1 is complete. A teacher can override one lesson to stay open.

**Student side**
- New lesson page with the stepper above. It remembers the stage you were on.
- **Video resume:** the player starts at the last position (saved every 10 seconds and when you leave).
- **Collapsible outline** on desktop, a sheet on phones, with ✓ done, ▶ current, 🔒 locked.
- A locked lesson shows "Finish *Lesson 1* to open this" with a button to go there. Never a dead page.

**Data (new, in plain words)**
- Lesson: description, objectives, estimated minutes.
- Block: which stage, optional or required.
- New block types: SLIDES, DIALOGUE (Phase B), VOCABULARY (Phase B).
- Video: source (hosted or external link), external address, captions file.
- Course: open-in-order switch. Lesson: "always open" override.
- Lesson progress: current stage, video position.

**Tests:** access (a locked lesson cannot be opened by direct link, the API refuses it), resume position, slide navigation by keyboard and swipe, phone 320 px, Arabic slides read right to left.

**Demo for sign-off:** build a lesson with slides, an external video with captions, turn on "in order", then walk through it as a student on a phone.

---

## 5. Phase B: Vocabulary, dialogues and matching questions

**Goal:** the language-learning content the brief asks for, in three languages.

**Vocabulary**
- A teacher adds words to a lesson (or imports a list from a spreadsheet/CSV): the word, its language, transliteration (for Arabic and Afaan Oromo, optional), **translations into English, Afaan Oromo and Arabic**, one example sentence with its translation, a picture (optional), and an **audio file** (upload, or record in the browser with the same microphone tool as chat).
- Student view: a card per word, a speaker button that plays the audio, the translations side by side (right to left where Arabic), and a **"Save"** star. Saved words collect in **My words** (a page in the student area), filterable by language and course.
- Words belong to a course language, so the Arabic course shows Arabic as the main word and translations next to it.

**Dialogues**
- A dialogue block is a short conversation: lines with a speaker name, text, translation, and an optional audio clip. The student can play line by line or the whole conversation.

**Matching questions**
- A new quiz question type: match each item on the left with one on the right (word to translation, word to picture). Scored by correct pairs, with partial marks. Works with the existing timer, attempts and explanations.

**Admin side:** a course-wide **word bank** view to search, fix and reuse words across lessons, and export to CSV.

**Tests:** import a CSV of 50 words, audio plays, saving a word survives sign-out, matching scores partial marks, Arabic cards align right.

**Demo:** add 10 words to a lesson with audio, play them as a student, save three, open My words, take a quiz with a matching question.

---

## 6. Phase C: Practice, time tracking, dashboard and analytics

**Goal:** practice from the words, honest time numbers, and a dashboard that feels alive.

**Practice activities (made automatically from the lesson's words, so teachers write nothing extra)**

| Activity            | How it works                                                                       |
| ------------------- | ---------------------------------------------------------------------------------- |
| Flashcards          | Flip a card. "I knew it / Not yet". Words you miss come back sooner (simple spaced repetition) |
| Word matching       | Tap a word, then its translation                                                   |
| Fill in the blank   | The example sentence with the word removed                                         |
| Sentence building   | Put the shuffled words of an example sentence in order                             |
| Spelling            | Hear the audio, type the word                                                      |
| Listening           | Hear a word or line, choose the right meaning                                      |
| Translation         | See a word, pick its translation in another language                               |

Each activity has Easy / Normal levels (fewer or more options, with or without hints), gives instant feedback, and saves the score. Teachers can switch activities on or off per lesson.

**Time tracking (what counts, and what does not)**
- **Video:** only seconds when the video is actually playing and the tab is visible. We also store which parts were watched, so replaying the same minute ten times counts once toward "watched", while "time spent" still reflects real time.
- **Slides:** the slides viewed, plus time on a slide, capped per slide so leaving one open does not inflate it.
- **Quiz:** from the server's own start and end of the attempt.
- **Practice:** active play time.
- **Idle rule:** if there is no tap, scroll, key or video progress for 60 seconds, the clock stops until activity returns.
- The browser sends a small "still here" note every 15 seconds. The server caps each note, so a faked or stuck tab cannot add hours.

**Student dashboard additions:** learning hours this week and in total, per-course time split (video / slides / quiz / practice), quiz history with scores, **My words** count, a **daily streak** (days in a row with at least a few minutes of learning), and a "Continue where you stopped" card that also resumes the video.

**Admin and teacher analytics (simple, no heavy charts):** per course: students active this week, average study time, the lessons where most students stop, average quiz score per quiz. Export to CSV, like the other reports. Teachers see their own courses only, with no phone numbers (as today).

**Tests:** time does not grow while idle or in a background tab, the same watched minute is not counted twice, a cheating request is capped, streak turns over at midnight Ethiopian time (EAT), all games work on a 320 px phone and with the keyboard.

**Demo:** play each activity, leave a lesson open and idle and show the timer stops, see the dashboard hours and streak, and the teacher's "where students stop" list.

---

## 7. Phase D (later, optional)

- **Daily word and review:** a short set of your saved words each day, with a reminder on the dashboard.
- **Achievements:** three to five simple badges (first lesson, first quiz passed, 7-day streak, course finished), shown on the dashboard.
- **Record yourself:** a student records their own voice for a word, listens back next to the teacher's audio. No automatic scoring.
- **PowerPoint upload:** the server converts a .pptx to slide pictures. This needs an extra tool on the server, so it comes last; until then teachers export to PDF, which works today.

---

## 8. Left out on purpose (advanced)

These are in the brief but are heavy and not needed to launch a good academy. They stay out of this plan:

| Left out                                          | Why                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Competitions and leaderboards                     | Needs fairness rules, moderation and privacy decisions. Adds little to learning              |
| Automatic pronunciation scoring (speech to text)  | Needs a paid speech service, and Afaan Oromo is poorly supported. The risk of wrong scores is high |
| Adaptive difficulty that changes by performance   | Needs months of data first                                                                  |
| A second certificate system                       | We already have certificates with numbers and a public verify page                          |
| Full game engine with levels, coins and rewards   | Our practice activities cover the learning value                                            |
| AI-generated lessons or exercises                 | Quality and cost control; revisit after launch                                              |
| Interface translated into Afaan Oromo and Arabic  | See decision 3 below. The learning content is already three-language                        |

---

## 9. Decisions I need from you

1. **Order of lessons.** Should "open in order" be the default for new courses, or "all open"? *Recommendation: all open by default, in order as a course setting.*
2. **Slides.** OK to build slides inside the app (and accept PDF decks) first, and leave PowerPoint conversion for Phase D? *Recommendation: yes.*
3. **Interface language.** Today the buttons and menus are in English while the *course content* can be English, Afaan Oromo or Arabic. Do you also want the **menus and buttons** in Afaan Oromo and Arabic (a language switch)? It is a separate piece of work (all texts translated, right-to-left layout everywhere). *Recommendation: after Phase C, as its own change request.*
4. **Translations in vocabulary.** Always all three (English, Afaan Oromo, Arabic), or any two? *Recommendation: any, with English optional, so the Afaan Oromo and Arabic courses are not forced to fill the third.*
5. **Streaks and time.** Is "daily streak" wanted, or does it put pressure on adult learners? *Recommendation: show it, but turn off by a switch in Settings.*
6. **YouTube.** Are teachers allowed to link YouTube videos (free, but Natik does not control them and they can be removed by the owner)? *Recommendation: allow, with a clear label in the builder.*

---

## 10. Public website and home page additions

The brief is about learning, but the public side should draw people in and show the new features. All of these use the real database, never sample text, and each can be switched off in **Admin › Website content**.

### Home page

| Addition                         | What visitors see                                                                                  | Needs                         | Phase |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- | ----- |
| **Find your level**              | A 10-question quick check (English, Afaan Oromo or Arabic) that ends with "Start at *Beginner*" and the matching course | Reuses quiz engine, no sign-up | A     |
| **How learning works**           | Four icons: Watch · Practise · Take the quiz · Get your certificate. Replaces the current text steps | Static, edited in Website content | A     |
| **Word of the day**              | One word with translation and a play button, in the visitor's chosen language, changing daily      | Vocabulary (Phase B)          | B     |
| **Try a free mini lesson**       | The free lesson player on the home page: a short practice (flashcards of 5 words) with no sign-up   | Practice (Phase C)            | C     |
| **Learning path by level**       | Beginner → Intermediate → Upper intermediate → Advanced, each linking to the filtered course list  | Existing levels               | A     |
| **Numbers that are true**        | Learners, courses, lessons, hours of video: counted live from the database. Hidden while the numbers are small | Existing data                 | A     |
| **Meet the teachers**            | Photo, name, languages and a one-line bio for teachers who chose "show on the website"             | Existing teacher setting      | A     |
| **Install the app**              | "Add Natik to your phone" button (works like an app, with a home-screen icon)                       | Web app manifest (small)      | A     |
| **Join our Telegram channel**    | A clear button next to the existing WhatsApp / Telegram helpers                                    | Existing contact settings     | A     |

```
Home page order (proposed, top to bottom)
┌──────────────────────────────────────────────┐
│ Hero: promise + "Find your level" + Register │
│ Languages: Arabic · English · Afaan Oromo    │
│ Featured courses                             │
│ How learning works (Watch/Practise/Quiz/Cert)│
│ Learning path by level                       │
│ Word of the day  |  Try a free mini lesson   │
│ Meet the teachers                            │
│ Numbers that are true                        │
│ Student quotes                               │
│ FAQ · News                                   │
│ Final call to action                         │
└──────────────────────────────────────────────┘
```

### Course page

| Addition                         | What visitors see                                                                             | Phase |
| -------------------------------- | --------------------------------------------------------------------------------------------- | ----- |
| **Curriculum outline**           | Units and lessons in a collapsible list, with lesson length and a "Free" tag on previews      | A     |
| **Course trailer**               | An optional short video above the description (uploaded or linked)                            | A     |
| **What you will practise**       | Counts: lessons, words, quizzes, estimated hours, calculated from the course                  | B     |
| **Teacher card**                 | Photo and bio of the course teacher                                                           | A     |
| **Related courses**              | Other courses in the same language or the next level                                          | A     |

### New public pages

| Page                     | Purpose                                                                                           | Phase |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ----- |
| `/find-your-level`       | The placement check, with a result and a button to the right course                               | A     |
| `/words`                 | A free word list per language (search, play audio). Good for people finding Natik on Google       | B     |
| `/teachers`              | All teachers who chose to appear, with their courses                                              | A     |

Every public page keeps the rules we already follow: works from 320 px wide, no sideways scrolling, passes the accessibility check, and never shows an error page.

---

## 11. Milestones, size and gates

We keep the same working rules as M1 to M8: **one phase at a time, I stop and wait for your OK.**

| Phase  | Contents                                                    | Size    | What you can try at the end                              |
| ------ | ----------------------------------------------------------- | ------- | -------------------------------------------------------- |
| **A**  | Lesson stages, slides, video upgrades, sidebar, unlock rules, public: placement check, path, teachers, install, outline | Large   | A full guided lesson on your phone                       |
| **B**  | Vocabulary, dialogues, matching questions, word bank, public: word of the day, `/words` | Large   | Words with audio, My words, a quiz with matching         |
| **C**  | Practice activities, time tracking, dashboard, analytics, public: mini lesson | Large   | Games, honest study time, streaks, teacher analytics     |
| **D**  | Daily review, achievements, record-yourself, PowerPoint     | Medium  | Optional extras                                          |

**How we make sure nothing breaks:** database changes only add tables and columns, so existing courses, lessons, quizzes, enrolments and certificates keep working unchanged. A lesson with no stages set up still shows as a normal lesson. Every phase ends with the existing test suites (API, browser on four screen sizes, accessibility) plus new tests for what was added.

**Risks to watch**
- *Time tracking accuracy* depends on browsers sending updates. Numbers are "good estimates", and we say so in the admin view.
- *Audio for every word* is a lot of work for teachers. We make recording quick, and the vocabulary works without audio.
- *Phones and slow internet:* slides and games load only when opened, images are resized, nothing autoplays (same rule as today).
- *YouTube links* depend on someone else. We label them, and hosted video stays the recommended way.

---

## 12. Next step

Read sections 2, 9 and 10, tell me your answers to the six decisions (and anything you want added or cut), and I will turn this into M9 to M12 files in the same format as the earlier milestones. I will not change any code before you approve.
