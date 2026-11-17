# M4: Public Website & Catalogue

|                |                |
| -------------- | -------------- |
| **Status**     | ✅ Approved |
| **Depends on** | M3 confirmed   |
| **Unlocks**    | M5             |
| **Size**       | Large          |

## Delivered early (before M3, at your request)

The public website was built ahead of schedule so the first impression is strong. What is **done**, and what is **left for M4**:

| Done now                                                                                                                                                                                                                                                                                                                                 | Left for M4                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Home (hero, trust strip, language cards, featured courses, how it works, why Natik, free lessons, news, FAQ, call to action), About, Courses with language and level filters, course pages, Free lessons page, News, Contact (working form into the inbox), FAQ, Privacy, Terms, Verify certificate, footer, sitemap, search-engine data | Website editor for admins (edit hero, FAQ, policies, contact details, testimonials, featured courses without a developer: FR-WEB-005) |
| Public API: courses (published only), filters, teachers, news, certificate check, contact form with bot protection and limits                                                                                                                                                                                                            | Admin Messages inbox to read and close contact messages; teacher/admin announcement posting                                           |
| Contact details read from settings and shown only when filled in                                                                                                                                                                                                                                                                         | Free lessons list and lesson pages (needs the M3 lesson builder)                                                                      |
| Sample courses and news for local development only                                                                                                                                                                                                                                                                                       | Testimonials section (needs real quotes from students)                                                                                |
| Browser tests at 320, 393, 768 and 1280 px                                                                                                                                                                                                                                                                                               | Lighthouse speed budgets enforced in CI; real photos and images                                                                       |

**Needs Natik's input before launch:** phone, email, address, opening hours, map link and social links (the `SITE_*` settings); real testimonials; real teacher photos and bios; a legal review of the Privacy notice and Terms (drafted in plain language from what the platform actually does).

## Goal

A fast, welcoming public site that presents Natik, lets visitors browse and filter courses and open free lessons, and gets them in touch. Admins edit the whole site without a developer. Announcements and the contact inbox are complete from end to end.

## Scope

**In:** Home, About, Courses (filters), Course details, Free lessons, Announcements, Contact, FAQ, Privacy, Terms. The website content editor for admins, announcements (admin + teacher posting), the contact form and admin Messages inbox, SEO, sitemap, performance budgets. Staging deploy as soon as Natik's hosting account is ready (README Q3).
**Out:** the enrol/pay actions behind the course buttons (M5), the Verify certificate page (M6), the student announcement feed with unread markers (M5).

## SRS covered

FR-WEB-001…007 · FR-CAT-001…003, 005, 006 (FR-CAT-004 visitor states here, all states in M5) · FR-NOTIF-001 · FR-ADMIN-007 (contact messages) · NFR-PERF-001, 003 · AT-01

---

## Screens

| Route                                           | Screen                                  | Primary action                                 |
| ----------------------------------------------- | --------------------------------------- | ---------------------------------------------- |
| `/`                                             | Home                                    | Browse courses                                 |
| `/courses`                                      | Catalogue with Language + Level filters | (card tap)                                     |
| `/courses/[slug]`                               | Course details                          | Register to enrol / Enrol free / Pay and enrol |
| `/courses/[slug]/lessons/[id]`                  | Free preview lesson (no sign-in)        | Register to continue                           |
| `/free-lessons`                                 | All free preview lessons                | Watch                                          |
| `/about`                                        | Story, approach, teachers, location     | Contact us                                     |
| `/announcements`                                | Public announcements                    | (read)                                         |
| `/contact`                                      | Details + form                          | Send message                                   |
| `/faq` · `/privacy` · `/terms`                  | Accordion FAQ, readable policy pages    |                                                |
| `/admin/website`                                | Website editor (tabs)                   | Save                                           |
| `/admin/announcements` · `/teach/announcements` | Post and manage announcements           | + New announcement                             |
| `/admin/messages`                               | Inbox: New / Closed                     | Close                                          |

```
Home (mobile, top to bottom; every section is short)
┌─────────────────────────────┐
│ [logo]        Sign in   ☰   │
├─────────────────────────────┤
│▓▓▓▓▓▓▓▓ NAVY HERO ▓▓▓▓▓▓▓▓▓▓│
│  Learn Arabic, English      │
│  & Afaan Oromo              │
│  With Natik's teachers,     │
│  at your own pace.          │
│  [ Browse courses ]         │
│  Try a free lesson →        │
├─────────────────────────────┤
│ ▬ Choose a language         │
│ ┌───────┐┌───────┐┌───────┐ │
│ │ عربي  ││English││ Oromo │ │
│ │6 crs  ││4 crs  ││3 crs  │ │
│ └───────┘└───────┘└───────┘ │
├─────────────────────────────┤
│ ▬ Featured courses     All →│
│ ┌──────────┐┌──────────┐ →  │  ← swipe row
│ │  image   ││  image   │    │
│ │ Title    ││ Title    │    │
│ │ AR·Beg   ││ EN·Int   │    │
│ │ ETB 1,500││ Free     │    │
│ └──────────┘└──────────┘    │
├─────────────────────────────┤
│ ▬ Free lessons              │
│ ▶ The Arabic alphabet       │
│ ▶ Everyday English phrases  │
│ ▶ Afaan Oromo greetings     │
├─────────────────────────────┤
│ ▬ How it works              │
│ ① Register  ② Enrol  ③ Learn│
│   & get certified           │
├─────────────────────────────┤
│ ▬ Students say              │
│ "…one short quote…" ★★★★★   │
│ — Name · Course     ● ○ ○   │
├─────────────────────────────┤
│ ▬ News             All →    │
│ Eid holiday hours · 2 Nov   │
├─────────────────────────────┤
│ Ready to start?             │
│ [Create free account]       │
│ Contact us                  │
├─────────────────────────────┤
│ footer                      │
└─────────────────────────────┘
▬ = small gold bar above section headings
```

```
Courses (mobile)                       Course details (mobile)
┌─────────────────────────────┐        ┌─────────────────────────────┐
│ Courses                     │        │ [      course image       ] │
│ (All)(Arabic)(English)(Oromo)│       │ Arabic for Beginners        │
│ Level: Any ▾      12 courses│        │ (Arabic) (Beginner)         │
├─────────────────────────────┤        │ 8 weeks · 24 lessons        │
│ ┌─────────────────────────┐ │        │ Teacher: Ustaz Ahmed        │
│ │ [image]                 │ │        ├─────────────────────────────┤
│ │ Arabic for Beginners    │ │        │ ▬ What you'll learn         │
│ │ Arabic · Beginner · 8 wk│ │        │ ✓ Read all 28 letters       │
│ │ ETB 1,500               │ │        │ ✓ Use short vowels          │
│ └─────────────────────────┘ │        │ ✓ Greet and introduce       │
│ ┌─────────────────────────┐ │        ├─────────────────────────────┤
│ │ …                       │ │        │ ▬ Course outline            │
│ └─────────────────────────┘ │        │ ▸ Unit 1 · Letters (6)      │
│                             │        │   • The alphabet    (Free)  │
│ No match?                   │        │ ▸ Unit 2 · Greetings (5)    │
│ (search) No courses match   │        ├─────────────────────────────┤
│ [Clear filters]             │        │ ▬ About this course         │
└─────────────────────────────┘        │ Four short lines… Read more │
                                       ├─────────────────────────────┤
                                       │ ETB 1,500 · 90 days         │
                                       │ [    Register to enrol    ] │ ← sticky
                                       └─────────────────────────────┘
```

```
Contact (mobile)                       Admin › Website (desktop)
┌─────────────────────────────┐        ┌──────────────────────────────────────────────┐
│ Contact us                  │        │ Website                              [Save]  │
│ 📍 Bole, Addis Ababa [Map]  │        │ Home · About · FAQ · Testimonials ·          │
│ 📞 +251 11 123 4567 (tap)   │        │ Policies · Contact                           │
│ ✈ Telegram · Facebook · TikTok│      ├──────────────────────────────────────────────┤
├─────────────────────────────┤        │ Hero title     [Learn Arabic, English …    ] │
│ Send a message              │        │ Hero subtitle  [With Natik's teachers …    ] │
│ Name   [                  ] │        │ Hero image     [ image ] Change              │
│ Phone  [+251|             ] │        │ Featured courses (drag to order)             │
│ Message[                  ] │        │  ⠿ Arabic for Beginners            ✕         │
│        [                  ] │        │  ⠿ English B1                      ✕         │
│ [      Send message       ] │        │  + Add course                                │
└─────────────────────────────┘        │                       View page ↗            │
 After sending: ✓ "Thanks! We'll       └──────────────────────────────────────────────┘
 get back to you soon."
```

### UX details

- **Home stays scannable.** Every section is a heading + cards or one line. No paragraph is longer than 2 lines.
- **Filters** are chips and a select. They update instantly, live in the URL (`/courses?language=arabic&level=beginner`), and show a result count. An empty result shows `EmptyState` + [Clear filters] (FR-CAT-006).
- **Course card** shows image, title, language · level · duration, and price or "Free" (FR-CAT-002), and nothing else.
- **Course page CTA** is a sticky bottom bar on mobile and a side card on desktop. Visitors see "Register to enrol" → `/register?next=/courses/slug`. Signed-in users see "Enrol free" / "Pay and enrol" (wired in M5).
- **Free lesson page** uses `LessonView`. A soft card at the end reads "Enjoyed it? Create a free account to continue." [Register].
- **Map** is a static preview image with an "Open in Maps" link, so no heavy map script loads (NFR-PERF-001).
- **About → teachers** come from teacher accounts marked "Show on website" (photo, name, languages, one-line bio).
- **Announcement form:** title, text, audience (Public / All students / One course), publish date. Teachers only see "One course", limited to their own courses.

---

## Backend

### Endpoints (`/api/v1`)

| Area             | Endpoints                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public catalogue | `GET /public/courses?language=&level=`, `GET /public/courses/:slug` (outline titles only, free-preview flags), `GET /public/lessons/:id` (free preview only)                        |
| Public site      | `GET /public/site` (home, about, contact, social), `GET /public/faq`, `GET /public/testimonials`, `GET /public/policies/:slug`, `GET /public/teachers`, `GET /public/announcements` |
| Contact          | `POST /public/contact` (honeypot + minimum fill time + 5/hour per IP)                                                                                                               |
| Website editor   | `GET/PUT /admin/site/:key`, CRUD `/admin/faq`, `/admin/testimonials` (+ reorder), `PUT /admin/policies/:slug`, `PUT /admin/featured-courses`                                        |
| Announcements    | CRUD `/admin/announcements` (all audiences), CRUD `/teach/announcements` (own courses only)                                                                                         |
| Inbox            | `GET /admin/messages?status=&type=`, `POST /admin/messages/:id/close`                                                                                                               |

### Rules to implement

- [ ] Public endpoints return **only published** courses, units and lessons, never drafts, hidden items or private data (FR-WEB-006). They have their own DTOs, separate from staff DTOs
- [ ] A non-free lesson requested through `/public/lessons/:id` → 404 (no hint that it exists)
- [ ] Course details include the course language `lang`/`dir`, so RTL titles in the outline render correctly
- [ ] Saving website content triggers on-demand revalidation (`revalidateTag`) of the affected pages, so changes appear within seconds (FR-WEB-005)
- [ ] Contact form: spam protection (honeypot, minimum fill time, rate limit). Optional email to staff through `SMTP_*`
- [ ] Announcement audience rules: PUBLIC shows on the site. ALL_STUDENTS and COURSE show only to students (feed in M5). Teachers post only to their assigned courses (SRS §3)
- [ ] Seed realistic demo content: 3 courses (one per language, one free), FAQ, 3 testimonials, policies placeholder text marked "to be confirmed by Natik"

### Web: speed and SEO

- [ ] Public pages are server components with static/ISR rendering. Client JavaScript only for the menu, filters, accordion and carousel
- [ ] `next/image` with AVIF/WebP, correct `sizes`, a priority hero image under 120 KB, lazy-loading below the fold (NFR-PERF-003)
- [ ] Per-page `<title>` + meta description, Open Graph image per course, `sitemap.xml`, `robots.txt`, Organization + Course JSON-LD (FR-WEB-007)
- [ ] **Lighthouse CI starts enforcing** the DESIGN.md §15 budgets on `/`, `/courses` and `/courses/[slug]`

---

## Tests

- **AT-01:** browse and filter → only published courses appear → a free preview lesson opens without sign-in
- Draft and hidden courses/lessons never appear in any public response (FR-WEB-006), and a non-free lesson by direct URL → 404
- Admin edits the hero text and FAQ → the public page updates without a deploy
- The contact form rejects the honeypot, too-fast submissions and the 6th message in an hour
- A teacher can't post an announcement to another teacher's course (403)
- Lighthouse (mobile, simulated 4G): homepage < 1.5 MB, LCP < 2.5 s, accessibility score ≥ 95

## Demo & sign-off

- [ ] Walk through every public page on a phone and on desktop. **Please check the look and the amount of text on each page**
- [ ] Filter the catalogue by language and level, including the "No courses match" state
- [ ] Open a free lesson as a visitor, then try a paid lesson's link (not available)
- [ ] Admin changes the hero, reorders featured courses, adds a FAQ item and edits Privacy. All show live
- [ ] Post a public announcement (admin) and a course announcement (teacher)
- [ ] Send a contact message, which appears in Admin › Messages. Close it
- [ ] Lighthouse report shared, all budgets green. Staging link shared if hosting is ready

**Your confirmation:** ☐ Approved, go to M5 · ☐ Changes needed: ________

---

## Delivered (build notes)

- **Free lessons:** `/free-lessons` lists every free-preview lesson; `/courses/[slug]/lessons/[id]` opens it for anyone, with a "create a free account" card. Course pages link their free lessons and show the "About this course" text. Anything that is not a published free preview answers "not found".
- **Website editor** (`/admin/website`): Home headline and featured courses (order, add, remove), About text, FAQ, testimonials (show/hide, reorder), Privacy and Terms (rich text, starting from the built-in draft), contact details and social links. Each block can go back to the standard wording. Saving refreshes the public pages at once.
- **Inbox** (`/admin/messages`): New / Closed, tap-to-call, close and reopen; the menu shows the count of new messages.
- **Announcements:** admins post to Everyone (News page), All students or One course, now or on a date; teachers post only to their own courses.
- **Contact details from Natik:** phone +251 93 591 5874, Telegram channel t.me/natikfluent, Telegram contact @Natikfluency. Saved in the website editor and seeded for new databases (never overwrites later edits).
- **Speed work:** public pages are now built once and cached (refreshed every 10 s and on every admin save); the few signed-in bits (header "Dashboard", course button) are decided in the browser. The shared package ships as ES modules so pages only load the code they use, which removed the form-validation library from public pages. An unused data-cache library was removed and toasts load after the page is ready.
- **Lighthouse CI** (`pnpm lhci`, CI job "Speed budgets"), phone on slow 4G with a 4x slower CPU, measured in the browser:

  | Page | Accessibility | LCP | JavaScript | Page weight | Layout shift |
  | ---- | ------------- | --- | ---------- | ----------- | ------------ |
  | `/` | 100 | 2.7 s | 240 KB | 585 KB | 0 |
  | `/courses` | 98 | 3.5 s | 240 KB | 470 KB | 0 |
  | `/courses/arabic-for-beginners` | 100 | 2.5 s | 242 KB | 424 KB | 0 |

  Met: accessibility ≥ 95, page weight under 1.5 MB (and under the 600 KB target), no layout shift. **Not yet met:** JavaScript 240 KB against the 150 KB target, and LCP 2.5–3.5 s against 2.5 s. Next.js and React alone are about 120 KB, so reaching 150 KB needs bigger changes (lighter menus and dialogs on public pages, fewer client translations). CI fails if pages get slower than today (LCP over 4.5 s, JavaScript over 250 KB) and reports the targets as warnings.
- **Open:** staging deploy (needs Natik's hosting, Q3), real testimonials (the local seed shows "Sample student" quotes), real teacher photos and bios, legal review of Privacy and Terms.
