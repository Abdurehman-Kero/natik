# M2: Accounts, Security & User Management

|                |                              |
| -------------- | ---------------------------- |
| **Status**     | 🔍 Waiting for your sign-off |
| **Depends on** | M1 confirmed                 |
| **Unlocks**    | M3                           |
| **Size**       | Large                        |

## Goal

People register with a phone and an SMS code, sign in safely, and recover their password. Admins manage users. From this milestone on, **every API request is checked for role and ownership.**

## Scope

**In:** registration, phone verification, sign-in, lockout, sessions, forgot/reset password, set password from an SMS link, profile, sign out, the permission layer, the SMS module (adapter + outbox + retry), rate limiting, the activity log writer, the storage service (needed for avatars), admin user management.
**Out:** course enrolment (M5). The admin view of failed SMS comes in M7.

## SRS covered

BR-AUTH-001…006 · FR-AUTH-001…008 · BR-ROLE-001…004 (foundation) · FR-ADMIN-002 · FR-ADMIN-008 (pattern) · FR-NOTIF-003 (codes, account created) · FR-NOTIF-004 (retry) · FR-REP-003 (sign-ins, role changes, disable/enable) · NFR-SEC-002, 005, 006 · AT-02, AT-03

---

## Screens

| Route                  | Screen                                                   | Primary action |
| ---------------------- | -------------------------------------------------------- | -------------- |
| `/register`            | Create account                                           | Create account |
| `/sign-in`             | Sign in                                                  | Sign in        |
| `/forgot-password`     | Phone → code → new password (3-step `Stepper`, one page) | Continue       |
| `/set-password?token=` | Set password (account created by admin)                  | Save password  |
| `/profile`             | Name, email, photo · Change password · Sign out          | Save           |
| `/admin/users`         | Search and filter users                                  | + New user     |
| `/admin/users/[id]`    | User details and actions                                 | Save           |

```
Register (mobile)                     Verify phone (mobile)
┌─────────────────────────────┐       ┌─────────────────────────────┐
│           [logo]            │       │           [logo]            │
│   Create your account       │       │      Enter your code        │
│                             │       │  Sent to +251 9•• ••• 678   │
│ Full name                   │       │                             │
│ [                         ] │       │  [_] [_] [_] [_] [_] [_]    │
│ Phone number                │       │                             │
│ [+251 | 91 234 5678       ] │       │  [         Verify         ] │
│ Password                    │       │                             │
│ [••••••••            Show ] │       │  Resend code in 0:45        │
│ 8+ characters, a letter & a number  │  Wrong number? Change it    │
│ I want to learn             │       └─────────────────────────────┘
│ (Arabic) (English) (Oromo)  │
│ Email (optional)            │       Sign in (mobile)
│ [                         ] │       ┌─────────────────────────────┐
│ [✓] I'm 16 or older and     │       │           [logo]            │
│     accept the Terms and    │       │       Welcome back          │
│     Privacy notice          │       │ Phone number                │
│                             │       │ [+251 |                   ] │
│ [     Create account      ] │       │ Password                    │
│                             │       │ [                    Show ] │
│ Have an account? Sign in    │       │ [✓] Keep me signed in       │
└─────────────────────────────┘       │            Forgot password? │
                                      │ [         Sign in         ] │
                                      │ New here? Create an account │
                                      └─────────────────────────────┘
```

```
Admin › Users (desktop; rows become cards on mobile)
┌───────────────────────────────────────────────────────────────────┐
│ Users                                               [+ New user]  │
│ [Search name or phone…      ]  Role: All ▾   Status: All ▾        │
├───────────────────────────────────────────────────────────────────┤
│ (AK) Abdi Kedir      +251 91 234 5678   Student   (Active)     ⋯  │
│ (SM) Sara Mohammed   +251 92 111 2233   Teacher   (Active)     ⋯  │
│ (HT) Hana Tesfaye    +251 93 444 5566   Admin ★   (Active)     ⋯  │
│ (MB) Musa Bekele     +251 70 777 8899   Student   (Disabled)   ⋯  │
├───────────────────────────────────────────────────────────────────┤
│                                              ‹ 1 2 3 … 12 ›       │
└───────────────────────────────────────────────────────────────────┘
⋯ menu: Edit · Send password link · Disable/Enable
```

### UX details

- **Registration is one short screen, then the code screen.** Nothing else is asked.
- The phone field shows a fixed `+251` and accepts `09…`, `07…`, `9…` and `+251…`. It formats as the user types.
- If the phone is already registered (FR-AUTH-003), show an inline message under the field: "This number already has an account." with **[Sign in] [Reset password]**.
- The code screen auto-submits when the 6th digit is entered. It accepts paste and SMS autofill, and shows a 60-second resend countdown.
- After verification, the user is signed in and taken to the page they came from (`?next=`), or else their dashboard.
- **No verification step (CR-1).** Registering signs the person in straight away; no SMS code is sent or asked for.
- After sign-in: students → `/dashboard`, teachers → `/teach`, admins → `/admin`. The public header now shows **Dashboard**.
- The lockout message is exactly the SRS §10 text, with a [Reset password] link.
- Disabling a user asks for confirmation in a `ConfirmDialog` (FR-ADMIN-008).

---

## Backend

### Endpoints (`/api/v1`)

| Method + path                               | Who          | Does                                                                                  |
| ------------------------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| `POST /auth/register`                       | visitor      | Validate and create an unverified user, then send the code                            |
| `POST /auth/otp/resend`                     | visitor/user | Resend a code for a purpose (limits apply)                                            |
| `POST /auth/sign-in`                        | visitor      | Phone + password + keepSignedIn                                                       |
| `POST /auth/sign-out`                       | user         | Revoke the current session                                                            |
| `POST /auth/password/forgot`                | visitor      | Always the same reply. Sends a code if the account exists                             |
| `POST /auth/password/reset`                 | visitor      | Phone + code + new password. Revokes all sessions                                     |
| `POST /auth/password/set`                   | visitor      | Token from the SMS link + new password                                                |
| `GET /me` · `PATCH /me`                     | user         | Profile (name, email)                                                                 |
| `POST /me/photo` · `POST /me/password`      | user         | Avatar (resized to webp) · change password (current one required)                     |
| `GET /admin/users`                          | admin        | Search by name/phone, filter by role/status, paged                                    |
| `POST /admin/users`                         | admin        | Create a student or teacher, sends the set-password SMS. **Admin role is Owner only** |
| `GET/PATCH /admin/users/:id`                | admin        | Edit name, email, role (Owner rules), teacher bio and "show on website"               |
| `POST /admin/users/:id/disable` · `/enable` | admin        | Disabling revokes sessions. Both are logged                                           |
| `POST /admin/users/:id/password-link`       | admin        | Sends a set-password SMS link (FR-ADMIN-002)                                          |

### Rules to implement

- [x] Phone normalisation and uniqueness (BR-AUTH-002). One shared function, with thorough unit tests
- [x] Password policy (BR-AUTH-003), Argon2id hashing (NFR-SEC-002)
- [x] OTP: 6 digits, hashed, 10 minutes, single use, at most 5 per phone per hour, at most 5 wrong tries per code, 60-second resend (BR-AUTH-004)
- [x] Lockout after 5 wrong passwords in 15 minutes, for 15 minutes (BR-AUTH-005)
- [x] Sessions per ARCHITECTURE §8: students 30 days / browser session, staff 60-minute idle (BR-AUTH-006)
- [x] No account enumeration on sign-in or forgot-password, with a dummy hash for equal timing (FR-AUTH-004)
- [x] Set-password link: 32-byte token, stored hashed, valid 72 hours (README Q6), single use
- [x] **Permission layer:** every route requires sign-in unless marked `@Public()`; `@Roles()` guard; own-record rule for profiles. The record-level `AccessPolicy` (assigned courses, enrolments) arrives with the content in M3 and M5
- [x] Owner rules: only the Owner creates admins or changes admin roles. Nobody changes their own role. The last Owner can't be demoted or disabled (BR-ROLE-004)
- [x] Rate limits with Redis: sign-in 10/min per IP · code sending 5/hour per phone and 20/hour per IP (NFR-SEC-005)
- [x] **SMS module:** `SmsProvider` interface, a `console` driver (dev) and a gateway driver (README Q2). `SmsMessage` outbox and `sms.send` job with 3 retries (FR-NOTIF-004)
- [x] **Dev SMS inbox** at `/dev/sms` (not in production) showing recent messages, so codes are easy to test
- [x] **Activity log writer:** `audit.record(actor, action, entity, details)` for sign-in (success and failure), role change, disable/enable, admin created, manual phone verification (FR-REP-003)
- [x] **Storage service:** S3 client, upload with a magic-byte type check and size limits, signed download URLs (reused heavily in M3)

---

## Tests

- **Unit:** phone normalisation (every input form, invalid numbers), password rules, OTP limits and expiry, lockout window
- **API:** register → verify → sign in · duplicate phone · wrong code ×5 · 6th code in one hour refused · lockout and unlock · reset revokes other sessions · same reply for unknown phone · set-password token used twice is refused
- **Permissions:** a student calling an `/admin/*` endpoint gets 403 · an admin (not Owner) creating an admin gets 403 · the last Owner can't be demoted · a user can't change their own role
- **E2E (Playwright, phone viewport):** AT-02 (register, code, verify, duplicate refused) and AT-03 (sign in, lockout, reset by SMS, sign out)

## Implementation notes (decisions made while building)

| Topic                        | What changed and why                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reset password               | Step 2 turns a valid SMS code into a short-lived single-use token (15 min), and step 3 uses the same `POST /auth/password/set` as the SMS link. So a wrong code is caught at step 2, not after typing a new password. This replaces the planned `POST /auth/password/reset`                                                |
| CR-1: no SMS at registration | Registering signs the person in and sends no SMS; the code screen, the "Verify your phone" banner, `POST /auth/verify-phone`, `POST /auth/otp/resend` and the admin "mark verified" action were removed. Codes remain only for **forgot password**, and SMS links for admin-created accounts and admin-sent password links |
| Register vs privacy          | FR-AUTH-003 requires telling someone their number is already registered, so register does (sign-in and forgot-password never do)                                                                                                                                                                                           |
| Sessions                     | Staff slide a 60-minute idle limit; students 30 days only if they tick the box. Changing a role, disabling, resetting or changing a password signs the person out elsewhere                                                                                                                                                |
| Limits                       | Per-phone code cooldown/limits are keyed on the number, never on whether an account exists. A test-only `RATE_LIMIT_MULTIPLIER` lets parallel browser tests run; it stays 1 everywhere else                                                                                                                                |
| Cross-site writes            | The server rejects writes whose browser `Origin` is another website. Skipped in local development so a phone on your Wi-Fi can test                                                                                                                                                                                        |
| Photos                       | Checked by real content (not file name), limited to 5 MB, re-encoded to a small WebP. Other file kinds stay closed until the milestone that defines who may open them                                                                                                                                                      |
| Modal forms                  | Edit details, change password, new/edit user, and the disable confirmation open as dialogs, as requested. Sign-in, register and the code screens stay full pages                                                                                                                                                           |
| Admin rules                  | Only the Owner manages admin accounts; nobody changes their own role or disables themselves; the last Owner can't be demoted or disabled                                                                                                                                                                                   |

## Tests (results)

| Suite                                                                                                                                                                                                           | Result                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Shared unit tests (phone formats, password rules, money, dates)                                                                                                                                                 | 40 / 40 ✅                         |
| API unit tests                                                                                                                                                                                                  | 37 / 37 ✅                         |
| API integration (21 account scenarios + 15 permission and Owner scenarios + earlier 4)                                                                                                                          | 40 / 40 ✅                         |
| Browser tests at 320, 393, 768 and 1280 px (register, codes, sign-in, lockout page flow, reset, profile dialogs, admin user dialogs, role guards, link crawl for every role, accessibility, no sideways scroll) | 128 / 128 ✅ (8 skipped by design) |
| Lint, types, formatting, production builds                                                                                                                                                                      | ✅                                 |

## Demo & sign-off

- [ ] Register on a phone-sized screen. Get the code from the dev SMS inbox and verify. You land on the dashboard shell
- [ ] Try the same phone again: it offers Sign in or Reset password
- [ ] 5 wrong passwords show the lockout message. Reset by SMS code, then sign in
- [ ] "Keep me signed in" survives a browser restart. Staff are signed out after 60 idle minutes (shown with a shortened timer in dev)
- [ ] Admin creates a teacher, who gets a set-password SMS link and sets a password
- [ ] Admin searches, disables and re-enables a user, with a confirmation dialog. The activity log has the rows (shown in the database until the M7 viewer exists)
- [ ] Profile: change name, photo and password, then sign out

**Your confirmation:** ☐ Approved, go to M3 · ☐ Changes needed: ________
