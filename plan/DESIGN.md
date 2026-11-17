# Design System and UX Rules

Every screen in every milestone follows these rules. The aim is **calm, clean, and light on text**: a student on a phone should know what to do within 3 seconds.

## 1. Seven rules for every page

1. **One job per page.** Each page has one clear purpose and **one primary button**. Other actions are secondary or tucked into a `⋯` menu.
2. **Short words.** Use the text budget below. If a page needs a paragraph to explain itself, redesign the page instead.
3. **Show, don't tell.** Prefer icons, status pills, progress bars and numbers over sentences.
4. **Reveal on demand.** Details go into accordions, drawers or "Read more", not onto the first view.
5. **Mobile first.** Design at 320–390 px first. Keep the main action within thumb reach (a sticky bottom bar where it helps).
6. **Four states always.** Loading (skeleton), empty (icon + one line + one button), error (plain words + next step) and success (toast or confirmation).
7. **Same thing, same look.** A status, button or card always looks and behaves the same in every area.

### Text budget

| Element                           | Max                                                              |
| --------------------------------- | ---------------------------------------------------------------- |
| Page title                        | 5 words                                                          |
| Subtitle under a title (optional) | 1 line, about 12 words                                           |
| Section heading                   | 4 words                                                          |
| Field hint                        | 1 line                                                           |
| Empty state                       | Title of 5 words + 1 line + 1 button                             |
| Button label                      | 1–3 words, starting with a verb ("Enrol free", "Submit payment") |
| Toast                             | 1 short sentence                                                 |
| Course card                       | Title + 3 facts (language, level, price)                         |

**Do:** `Payment under review`, then `We'll text you when access is ready.`
**Don't:** a paragraph explaining how payment checking works.

## 2. Brand tokens

Colours come from the approved palette (SRS D9) and the logo. They are defined once as CSS variables (Tailwind `@theme`).

| Token                      | Hex                   | Use                                                                           | Contrast                                 |
| -------------------------- | --------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| `primary`                  | `#123B5A`             | Primary buttons, links, active nav, headings                                  | 11.7:1 on white ✓                        |
| `primary-hover`            | `#0E2F48`             | Hover/pressed                                                                 | ✓                                        |
| `primary-soft`             | `#E8EEF3`             | Selected rows, soft badges, icon circles                                      |                                          |
| `accent`                   | `#B69A4A`             | Gold accents: heading bar, progress at 100%, "completed", certificates, stars | 2.7:1, **decorative only**               |
| `accent-strong`            | `#7A6428`             | The only gold allowed for text (small labels, "Completed" pill)               | 5.7:1 on white, 4.9:1 on `accent-soft` ✓ |
| `accent-soft`              | `#F4EFE1`             | Gold-tinted backgrounds (completed pill, highlight cards)                     |                                          |
| `bg`                       | `#F7F6F2`             | Page background                                                               |                                          |
| `surface`                  | `#FFFFFF`             | Cards, inputs, sheets                                                         |                                          |
| `text`                     | `#202A32`             | Body text                                                                     | 14.9:1 ✓                                 |
| `text-muted`               | `#5B6670`             | Meta text, hints                                                              | 5.9:1 ✓                                  |
| `border`                   | `#E5E1D6`             | Card and input borders, dividers                                              |                                          |
| `success` / `success-soft` | `#276B43` / `#E6F2EA` | Published, confirmed, correct                                                 | 5.6:1 on `success-soft` ✓                |
| `border-strong`            | `#8A9096`             | Input and control borders (must stay visible: 3.2:1, WCAG 1.4.11)             | ✓                                        |
| `subtle`                   | `#EEECE6`             | Muted pill background, skeletons                                              |                                          |
| `warning` / `warning-soft` | `#8A5A00` / `#FBF0D9` | Under review, waiting, mismatch                                               | ✓                                        |
| `danger` / `danger-soft`   | `#B42318` / `#FCE9E7` | Errors, rejected, cancelled, destructive                                      | ✓                                        |

Rules:

- **Gold is never used for body text or small text on white** (FR-UI-001). Use `accent-strong` when gold text is unavoidable.
- In code, `bg` is `canvas`, `text` is `ink` and `text-muted` is `muted` (e.g. `bg-canvas text-ink`). This avoids awkward names like `text-text`.
- No white (2.7:1) or navy (4.3:1) text on a gold background. Use `ink` text on gold (5.4:1), e.g. the gold "Download certificate" button.
- Never rely on colour alone. Every status also has an icon and a word.
- One light theme for the MVP. There is no dark mode.

## 3. Typography

| Style            | Font               | Mobile → Desktop                           | Weight / line height            |
| ---------------- | ------------------ | ------------------------------------------ | ------------------------------- |
| Display (hero)   | Montserrat         | 32 → 48 px                                 | 700 / 1.15                      |
| H1               | Montserrat         | 26 → 36 px                                 | 700 / 1.2                       |
| H2               | Montserrat         | 22 → 28 px                                 | 600 / 1.25                      |
| H3               | Montserrat         | 18 → 20 px                                 | 600 / 1.3                       |
| Body             | Inter              | 16 px (never smaller on phones, FR-UI-002) | 400 / 1.6                       |
| Small / meta     | Inter              | 14 px (meta only, never key information)   | 400 / 1.5                       |
| Arabic content   | Noto Naskh Arabic  | 20 → 22 px                                 | 400 / 1.9 (room for diacritics) |
| Ethiopic content | Noto Sans Ethiopic | 17 px                                      | 400 / 1.7                       |

- Montserrat echoes the logo's "NATIK" wordmark, and Inter keeps long reading comfortable.
- Fonts load through `next/font` with subsets and `display: swap`. The Arabic and Ethiopic fonts load **only** on pages that show content in those scripts.
- Reading width is at most 70 characters (about 720 px) for lessons and policies.

## 4. Space, shape and depth

| Token                      | Value                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| Spacing scale              | 4 px base: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 80                                              |
| Page gutter                | 16 px (mobile) · 24 px (tablet) · 32 px (desktop)                                                |
| Section gap (public pages) | 48 px mobile → 80 px desktop                                                                     |
| Card padding               | 16 px mobile → 24 px desktop                                                                     |
| Container                  | max 1200 px. Reading column max 720 px                                                           |
| Radius                     | 8 px inputs · 12 px buttons and cards · full for pills and avatars                               |
| Shadow                     | One soft shadow for cards (`0 1px 2px rgba(18,59,90,.06)`) and one for overlays. Nothing heavier |
| Tap target                 | At least 44 × 44 px                                                                              |
| Motion                     | 150–200 ms ease-out. Off when `prefers-reduced-motion` is set                                    |
| Breakpoints                | `sm 640` · `md 768` · `lg 1024` · `xl 1280`                                                      |

**Brand touches (kept subtle):**

- A small gold bar (32 × 3 px) above section headings, taken from the logo's gold stroke.
- The public hero uses a navy background with a very faint gold calligraphic watermark (inline SVG at about 6% opacity).
- Gold marks achievement: completed courses, passed quizzes and certificates.

## 5. Icons and imagery

- **Lucide** line icons, 20 px in UI and 24 px in navigation, stroke 1.75, colour `primary` or `text-muted`.
- Course images use a 16:9 ratio. Teacher photos are square and shown as circles.
- Use real Natik photos where possible. Natik supplies them; until then, a neutral navy pattern placeholder.
- Illustrations are not used. Empty states use one icon in a `primary-soft` circle.

## 6. Component library (built in M1, used everywhere)

| Group      | Components                                                                                                                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actions    | `Button` (primary · secondary · ghost · danger · sizes · loading), `IconButton`, `LinkButton`                                                                                                                                                                                                                           |
| Inputs     | `TextField`, `PhoneField` (fixed `+251` prefix, numeric keypad), `PasswordField` (show/hide + rule hint), `OtpField` (6 boxes, paste, `autocomplete="one-time-code"`), `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioCards`, `DateField`, `MoneyField`, `FileDrop` (type/size hint, progress, retry), `SearchField` |
| Form       | `FormField` (label, hint, inline error linked by `aria-describedby`), `FormActions`                                                                                                                                                                                                                                     |
| Display    | `Card`, `CourseCard`, `StatCard`, `StatusPill`, `Badge`, `Avatar`, `ProgressBar`, `ProgressRing`, `EmptyState`, `Skeleton`, `DataTable` (cards under 768 px), `KeyValue`, `Timeline`                                                                                                                                    |
| Navigation | `PublicHeader`, `Footer`, `Sidebar`, `BottomTabs`, `Breadcrumb`, `Tabs`, `Pagination`, `Stepper`                                                                                                                                                                                                                        |
| Overlay    | `Dialog`, `ConfirmDialog` (optional required reason), `Sheet` / `Drawer`, `DropdownMenu`, `Tooltip`, `Toast`                                                                                                                                                                                                            |
| Layout     | `PageHeader` (title + optional subtitle + one action), `SectionHeading` (gold bar), `Container`, `StickyActionBar` (mobile)                                                                                                                                                                                             |
| Content    | `RichText` (sanitised, `dir` aware), `VideoEmbed` (click-to-load facade), `PdfViewer` (pdf.js, lazy), `AudioPlayer` (play/pause, replay 10 s, speed 0.75–1.5×), `ImageBlock`                                                                                                                                            |

## 7. Status pills (one mapping everywhere)

| Status                          | Pill                                                                | Icon                                 |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| ACTIVE                          | navy on `primary-soft`, "Active"                                    | `circle-play`                        |
| COMPLETED                       | `accent-strong` on `accent-soft`, "Completed"                       | `award`                              |
| AWAITING_PAYMENT                | warning, "Payment needed"                                           | `wallet`                             |
| PAYMENT_SUBMITTED               | warning, "Payment under review"                                     | `clock`                              |
| EXPIRED                         | muted grey, "Expired"                                               | `calendar-x`                         |
| CANCELLED                       | danger, "Cancelled"                                                 | `x-circle`                           |
| Payment CONFIRMED / REJECTED    | success "Confirmed" / danger "Rejected"                             | `check` / `x`                        |
| DRAFT / PUBLISHED / HIDDEN      | grey "Draft" / success "Published" / muted "Hidden"                 | `pencil` / `globe` / `eye-off`       |
| Quiz: passed / failed / waiting | gold "Passed" / danger "Not passed" / warning "Waiting for marking" | `award` / `rotate-ccw` / `hourglass` |

## 8. Layout shells

**Public** (visitors, and anyone on public pages)

```
Mobile                                Desktop
┌─────────────────────────────┐       ┌──────────────────────────────────────────────────────────┐
│ [logo]        Sign in   ☰   │       │ [logo]  Courses  Free lessons  About  Contact  Sign in [Register] │
├─────────────────────────────┤       ├──────────────────────────────────────────────────────────┤
│          content            │       │                         content                          │
├─────────────────────────────┤       ├──────────────────────────────────────────────────────────┤
│ footer: contact · social ·  │       │ footer: logo · contact · social · policy links           │
│ policies                    │       └──────────────────────────────────────────────────────────┘
└─────────────────────────────┘
```

When signed in, `Sign in / Register` becomes **Dashboard** (FR-WEB-002).

**Student** (4 tabs, nothing more)

```
Mobile                                Desktop
┌─────────────────────────────┐       ┌────────────┬─────────────────────────────────────┐
│ [logo]              🔔  (AK) │       │ [logo]     │ Page title                🔔  (AK)  │
├─────────────────────────────┤       │ Home       ├─────────────────────────────────────┤
│                             │       │ My courses │                                     │
│          content            │       │ Certificates│            content                 │
│                             │       │ Profile    │                                     │
├─────────────────────────────┤       │            │                                     │
│ Home  Courses  Certs  Profile│       └────────────┴─────────────────────────────────────┘
└─────────────────────────────┘
```

Announcements live under the bell, which shows an unread dot. Payments sit inside Profile and on each course card.

**Teacher / Admin** (sidebar that collapses to a drawer on mobile)

```
┌──────────────┬──────────────────────────────────────────┐
│ [logo]       │ Page title                    [Primary]  │
│ Dashboard    ├──────────────────────────────────────────┤
│ Courses      │                                          │
│ Marking  (7) │                content                   │
│ Announcements│                                          │
│ ──────────── │                                          │
│ (SM) Profile │                                          │
└──────────────┴──────────────────────────────────────────┘
```

Admin sidebar groups: **Overview** (Dashboard) · **People** (Users, Enrolments) · **Learning** (Courses, Marking) · **Money** (Payments to check, with a badge) · **Communication** (Announcements, Messages, with a badge) · **Website** · **Insights** (Reports, Activity log) · **Settings**.

## 9. Forms

- One column. Labels sit above fields, and only optional fields are marked "(optional)".
- Validate on blur, and on submit. Show the error **under the field**, in plain words, and keep what the user typed.
- Set the right keyboard and autofill: `tel`, `inputmode="numeric"` for codes and amounts, `autocomplete="name|tel|new-password|current-password|one-time-code"`.
- Disable the submit button only while sending, and show a spinner inside it. Don't disable it for invalid input; show the errors instead.
- Long forms (course editor) go in titled cards. On mobile the primary button stays in a sticky bottom bar.
- Destructive actions use `ConfirmDialog` with a verb-labelled button ("Cancel enrolment", never "Yes"). A **reason** field is required where the SRS asks for one (reject payment, cancel enrolment, cancel certificate) (FR-ADMIN-008).

## 10. Feedback and states

| State   | Pattern                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Loading | A skeleton shaped like the final layout. Never a full-page spinner                                                                   |
| Empty   | `EmptyState`: icon + title + 1 line + 1 button (e.g. "No courses yet" → "Browse courses")                                            |
| Error   | Inline next to the problem, plus what to do next (SRS §10 wording). Network errors offer "Try again"                                 |
| Success | Toast at the bottom on mobile, top-right on desktop, for 4 s. Big moments (payment sent, quiz passed) get a full confirmation screen |
| Saving  | Quiet "Saving…" / "Saved ✓" text for autosave (quiz answers, lesson drafts)                                                          |
| Offline | A slim banner: "You're offline. Your answers are saved and will be sent when you reconnect."                                         |

## 11. Tables and lists

- Search, then at most 2 visible filters, then the rest under a "Filters" sheet.
- Under 768 px a row becomes a card showing its 2–3 most important facts. Row actions go in a `⋯` menu.
- Missing values show "—", never 0 (FR-REP-002).
- Sorting and filters live in the URL, so views can be shared and survive a refresh.

## 12. Words and formats

| Thing     | Format                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| Money     | `ETB 1,500`, or `Free`                                                                 |
| Dates     | `4 Nov 2026`, in EAT. Relative ("2 days ago") only in queues and feeds                 |
| Phone     | `+251 91 234 5678`. Masked as `+251 9•• ••• 678` wherever the full number isn't needed |
| Durations | `8 weeks`, `12 lessons`, `15 min`                                                      |
| Tone      | Friendly, direct, second person. No jargon ("enrolment" is fine, "entity" is not)      |

Error messages come straight from SRS §10. They live in `messages/en.json`.

## 13. Arabic, Afaan Oromo and Amharic content

- The interface is English and left-to-right (SRS D1). **Content** containers set `lang` and `dir` from the course language (`ar` → `dir="rtl"`).
- Inside rich text, each paragraph uses `dir="auto"`, and teachers can force RTL or LTR per paragraph.
- Quiz questions, options and fill-in answers in Arabic are right-to-left too. Interface chrome (buttons, nav) is never mirrored.
- Arabic text uses Noto Naskh Arabic at a larger size, so diacritics (harakat) stay clear (FR-LEARN-011, FR-UI-004).
- Text is Unicode-normalised (NFC) before it is stored and compared.

## 14. Accessibility (WCAG 2.1 AA basics, NFR-USE-002)

- [ ] Contrast meets the token table. No information is carried by colour alone
- [ ] Every input has a visible label. Errors are linked by `aria-describedby`
- [ ] Focus ring: 2 px `primary` with a 2 px offset (white on navy backgrounds), visible on every interactive element
- [ ] Keyboard only: logical tab order, a skip-to-content link, dialogs trap focus and close with Esc
- [ ] Tap targets are at least 44 px
- [ ] Images have `alt`. Decorative ones use `alt=""`
- [ ] Video and audio controls are keyboard-operable
- [ ] `prefers-reduced-motion` is respected

## 15. Performance budget (enforced by Lighthouse CI from M4)

Measured results and which targets are met: see M4 › Delivered. Config: `lighthouserc.cjs`.

| Page type              | Budget                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Homepage total         | < 1.5 MB (SRS). Target < 600 KB                                                       |
| Public page JavaScript | < 150 KB gzipped                                                                      |
| LCP (mobile, 4G)       | < 2.5 s. Full load ≤ 3 s (NFR-PERF-001)                                               |
| Hero image             | < 120 KB (AVIF/WebP)                                                                  |
| Heavy pieces           | pdf.js, Tiptap, video player and maps load **only** where they're used, and on demand |

## 16. Logo use

- **Full lockup** (mark + "ناطق" + "NATIK | ናጢቅ" + "Language Centre" + Amharic): only where it can be shown **at least 240 px tall**, so its small lines stay readable: certificate, About page, social share image.
- **Compact** (mark + "NATIK" + "Language Centre" as live text): headers, footer, sign-in and register pages.
- **Mark only**: favicon, app icon, mobile menu.
- Keep clear space equal to the height of the gold quill, and never stretch, recolour or add effects.
- Navy backgrounds need the reversed (white/gold) version. That is requested from Natik (README Q10).
