# M3: Course Builder (Courses, Content & Media)

|                |                |
| -------------- | -------------- |
| **Status**     | ✅ Approved |
| **Depends on** | M2 confirmed   |
| **Unlocks**    | M4             |
| **Size**       | Large          |

## Goal

Admins create courses and assign teachers. Teachers build units and lessons with text, video, PDF, audio and images, preview them exactly as a student will, and publish them directly (SRS D5).

## Scope

**In:** admin course management, languages and levels lists, teacher assignment, the teacher dashboard (basic), the course content editor (units and lessons), the lesson editor (blocks), file and video upload, the shared **LessonView** used for previews (and later by free lessons and students), publish/hide, access-checked media delivery.
**Out:** quizzes (M6), enrolment and progress (M5), the public catalogue (M4).

## SRS covered

FR-ENR-001 · FR-CAT-001 (editable languages and levels) · FR-ADMIN-003, 004, 005 · FR-TEACH-001 (basic), 002, 003, 004, 007, 008 · FR-LEARN-006…011 · D5, D7, D8 · AT-12 (content part), AT-15 (renderer)

---

## Screens

| Route                                    | Screen                                                                      | Primary action |
| ---------------------------------------- | --------------------------------------------------------------------------- | -------------- |
| `/admin/courses`                         | Course list (cards: image, title, language, status, students)               | + New course   |
| `/admin/courses/new` · `/[id]`           | Course details form in titled cards. Tabs: **Details · Content · Teachers** | Save           |
| `/admin/settings/catalogue`              | Languages and levels (add, rename, reorder, deactivate)                     | Add            |
| `/teach`                                 | My courses (basic dashboard; marking count comes in M6)                     | Open course    |
| `/teach/courses/[id]`                    | Course content editor: units and lessons tree                               | + Add unit     |
| `/teach/courses/[id]/lessons/[lessonId]` | Lesson editor                                                               | Publish / Save |
| `…/lessons/[lessonId]/preview`           | Lesson preview, exactly as a student sees it                                | Back to editor |

```
Course content editor (desktop)
┌──────────────────────────────────────────────────────────────────┐
│ ← My courses                                                     │
│ Arabic for Beginners                (Published)     [Preview]    │
├──────────────────────────────────────────────────────────────────┤
│ Units & lessons                                    [+ Add unit]  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ⠿ Unit 1 · Letters and sounds               (Published)  ⋯   │ │
│ │    ⠿ 1  The alphabet       ▶ PDF          (Published)    ›   │ │
│ │    ⠿ 2  Short vowels       ▶ ♪            (Draft)        ›   │ │
│ │    + Add lesson                                              │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ ⠿ Unit 2 · Greetings                        (Draft)      ⋯   │ │
│ │    + Add lesson                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
⠿ = drag handle (plus "Move up / Move down" in ⋯ for keyboard and touch)
```

```
Lesson editor (desktop; the settings card drops below on mobile)
┌──────────────────────────────────────────────────────────────────┐
│ ← Unit 1 · Letters and sounds                                    │
│ [Short vowels                             ]  (Draft)  Saved ✓    │
│                                     [Preview] [Save] [Publish]   │
├─────────────────────────────────────────────┬────────────────────┤
│ ┌ Text ───────────────────────── ↑ ↓ ✕ ┐   │ Lesson settings    │
│ │ B I H2 • 1. 🔗 🖼  ⇄RTL               │   │                    │
│ │ الفتحة  ـَ  …                         │   │ Free preview  [ ]  │
│ └───────────────────────────────────────┘   │ Allow downloads[✓] │
│ ┌ Video ──────────────────────── ↑ ↓ ✕ ┐   │                    │
│ │ Vowels song          (Ready) 3:12     │   │ Quiz               │
│ └───────────────────────────────────────┘   │ Comes in M6        │
│ ┌ PDF ────────────────────────── ↑ ↓ ✕ ┐   │                    │
│ │ vowel-chart.pdf · 1.2 MB              │   │                    │
│ └───────────────────────────────────────┘   │                    │
│                                             │                    │
│  [+ Text] [+ Video] [+ PDF] [+ Audio] [+ Image]                  │
└─────────────────────────────────────────────┴────────────────────┘
```

```
LessonView: what students see (shared component, mobile)
┌─────────────────────────────┐
│ ←  Short vowels             │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │      ▶  (poster)        │ │  ← loads the player only on tap
│ └─────────────────────────┘ │
│                             │
│        الفتحة  ـَ           │  ← RTL, Naskh, 20 px
│                             │
│ ┌─────────────────────────┐ │
│ │ 📄 Vowel chart   [Open] │ │  ← in-page pdf.js viewer
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ ▶  ──●────── 0:42  1×   │ │  ← audio: play, ↺10s, speed
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### UX details

- **Adding a block** is one tap on a labelled chip. No modal "type picker".
- **Video:** choose a file. It uploads in the background with a progress bar (resumable), then shows "Processing…" and then "Ready". The teacher can keep editing meanwhile.
- **Upload errors** use the SRS wording: "This file is 32 MB. The maximum is 25 MB."
- **Draft safety:** the editor autosaves drafts every few seconds ("Saved ✓"). Leaving with unsaved changes asks first. Editing a **published** lesson shows "Changes go live when you save".
- **Publish** checks the basics first (title present, at least one block) and explains inline what's missing.
- **Hide vs delete:** never-published drafts can be deleted. Published or hidden items can only be hidden, because hiding keeps student results (FR-TEACH-008).
- **The teacher sees course settings read-only** (price, access, Free/Paid). Nothing on the screen invites editing them (FR-TEACH-007).
- **Course form** (admin) is grouped into cards: _Basics_ (title, language, level, image, summary) · _Content_ (description, what you will learn, duration) · _Access_ (Free/Paid, price ETB, access days or "Unlimited") · _Visibility_ (status, featured).

---

## Backend

### Endpoints (`/api/v1`)

| Area            | Endpoints                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Courses (admin) | `GET/POST /admin/courses`, `GET/PATCH /admin/courses/:id`, `POST …/publish`, `…/hide`, `PUT …/teachers`                                              |
| Lists (admin)   | `GET/POST/PATCH /admin/languages`, `/admin/levels` (+ reorder)                                                                                       |
| Teacher         | `GET /teach/courses` (assigned only; admins see all), `GET /teach/courses/:id/outline`                                                               |
| Units           | `POST /teach/courses/:id/units`, `PATCH/DELETE /teach/units/:id`, `POST /teach/units/reorder`, publish/hide                                          |
| Lessons         | `POST /teach/units/:id/lessons`, `GET/PATCH/DELETE /teach/lessons/:id`, `POST /teach/lessons/reorder` (also across units), publish/hide              |
| Blocks          | `POST /teach/lessons/:id/blocks`, `PATCH/DELETE /teach/blocks/:id`, `POST /teach/lessons/:id/blocks/reorder`                                         |
| Files           | `POST /files` (multipart, purpose), `GET /files/:id` (access check → 5-minute signed URL)                                                            |
| Video           | `POST /videos` (create, returns resumable upload credentials), `GET /videos/:id` (status), `GET /videos/:id/embed` (access check → signed embed URL) |
| Preview         | `GET /teach/lessons/:id/view` (the same render model students will get)                                                                              |

### Rules to implement

- [ ] Course: slug from the title (editable, unique). Free → no price. Paid → price required (stored in santim). Access days or unlimited (FR-ENR-001)
- [ ] Publishing a course needs title, language, level, summary, image and price (if paid)
- [ ] Visibility rule: students see an item only when it **and all its parents** are PUBLISHED (ARCHITECTURE §6)
- [ ] `AccessPolicy.canEditCourseContent`: admin or assigned teacher. `canEditCourseSettings`: admin only (FR-TEACH-007, FR-ADMIN-005)
- [ ] Delete is allowed only for never-published items. Everything else is hide (FR-TEACH-008). No cascade deletes
- [ ] Rich text: Tiptap JSON is stored. Rendered server-side to HTML sanitised with an allow-list. Per-paragraph `dir` is preserved (FR-TEACH-003, FR-LEARN-011)
- [ ] Uploads: type checked by magic bytes, limits from ARCHITECTURE §10. Images converted to responsive webp (NFR-PERF-003)
- [ ] `GET /files/:id` and `/videos/:id/embed` always run `canOpenLesson`. The **free-preview** flag opens them to everyone (FR-LEARN-010, FR-CAT-005)
- [ ] PDFs/audio: `Content-Disposition: attachment` only if "Allow downloads" is on. Videos are never downloadable (D7)
- [ ] `VideoProvider` interface + Bunny Stream adapter: resumable upload, status webhook/polling, token-signed embeds, domain allow-list (FR-LEARN-007, D8)
- [ ] Player: no autoplay, no preload, starts at low/auto quality for slow networks (FR-LEARN-006, §14 risk)
- [ ] `progress.recalc` job queued whenever a lesson is published or hidden (used from M5)
- [ ] Activity log: course created/published/hidden, teacher assignment changes

### Web components built here

- [ ] `LessonView` (blocks renderer: `RichText`, `VideoEmbed`, `PdfViewer`, `AudioPlayer`, `ImageBlock`), with content `lang`/`dir` taken from the course language
- [ ] `RichTextEditor` (Tiptap, lazy-loaded, limited toolbar: B, I, H2, H3, lists, link, image, RTL/LTR)
- [ ] `OutlineEditor` (dnd-kit sortable + keyboard move up/down)
- [ ] `UploadQueue` (shows progress for multiple uploads, retry on failure)

---

## Tests

- **Permissions:** teacher A can't read or edit teacher B's course (AT-12) · a teacher can't change price/access/Free-Paid/featured (FR-TEACH-007) · `GET /files/:id` and `/videos/:id/embed` without access → 403 (part of AT-07)
- **Rules:** a hidden unit hides its lessons from the student view · deleting a published lesson is refused · reorder across units keeps order consistent
- **Uploads:** a 32 MB PDF is refused with the SRS message · a `.exe` renamed to `.pdf` is refused · images become webp
- **Rendering:** Arabic text with diacritics renders RTL in Naskh (visual snapshot on Android and iOS emulation, AT-15)
- **E2E:** admin creates a course and assigns a teacher → teacher adds a unit and a lesson with text, video, PDF and audio → preview → publish

## Demo & sign-off

- [ ] Admin creates "Arabic for Beginners" (Paid, ETB 1,500, 90 days) and assigns a teacher. Admin adds a new level in Settings
- [ ] Teacher signs in and sees only their courses. Adds Unit 1 and a lesson with Arabic text with harakat, a video, a PDF and an audio file
- [ ] Preview on a phone: video plays on tap only, PDF opens in the page, audio speed works, Arabic reads right-to-left
- [ ] Publish, hide and publish again. Drag to reorder lessons
- [ ] Teacher can't edit the price, and can't open another teacher's course (403 page)

**Your confirmation:** ☐ Approved, go to M4 · ☐ Changes needed: ________

---

## Delivered (build notes)

- **Course management:** `/admin/courses` (list, filter, search), `/admin/courses/new` and `/[id]` (Details · Content · Teachers), `/admin/settings/catalogue` (languages and levels: add, edit, reorder, hide, remove when unused), settings hub.
- **Teacher workspace:** `/teach` and `/teach/courses` (assigned courses only; admins see all), outline editor (units and lessons; drag handle plus Move up/down; move to another unit; hide or delete rules), lesson editor (text, video, PDF, audio, picture blocks; autosave; publish checks), preview using the same `LessonView` students will use.
- **Media:** uploads check the real file type from the first bytes, size limits use the SRS wording, pictures become WebP. Lesson files stream through the API with an access check on every request (including byte ranges for audio/video). Downloads only when the lesson allows them; videos never.
- **Video:** `VideoProvider` interface with a Bunny Stream adapter (resumable TUS upload, signed embed links, no autoplay or preload) and a development-only `local` provider (max 100 MB). Production refuses `VIDEO_PROVIDER=local`.
- **Decision (ARCHITECTURE §10 updated):** lesson files are streamed by the API instead of redirecting to a signed storage URL, so the in-page PDF reader works without bucket CORS setup and access is checked on every byte-range request.
- **Not yet verified against the real service:** the Bunny adapter (needs a Bunny library and keys; signing and URL formats follow Bunny's documentation).
- Tests: 21 new API integration tests, rich-text and file-type unit tests, and browser tests for the full admin → teacher journey on phone and desktop plus a 20 MB upload through the website.
