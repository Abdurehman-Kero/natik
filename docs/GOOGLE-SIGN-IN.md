# "Continue with Google": setup, about 15 minutes

Free, no card. People can then sign up and sign in with their Google account. Until you do the steps below the button simply does not
appear, and everything else works as before.

## How it behaves

- **New person** → Google → a short page to accept the Terms and confirm they are 16 or older (and optionally add phone and place) →
  the account is created and they are signed in. They get **no password**; they can choose one later with "Set a password" in the
  Profile (a code is emailed to them).
- **Person who already used Google** → straight in.
- **Account an admin created** for that email, which has not been given a password yet (a teacher, for example) → Google connects it
  and signs them in. Google has proved the email is theirs.
- **Account that already has a password** → Google does **not** sign in or take it over (anyone can register with someone else's email,
  so this would hand the account to the wrong person). The sign-in page says: sign in with your password, then press **Connect** next
  to Google in the Profile.
- Only emails that **Google has verified** are accepted.
- Disabled accounts cannot sign in this way either.

## 1. Create the Google "app" (once)

1. Open <https://console.cloud.google.com/> with the Google account that should own this (the centre's account, not a personal one if
   you can avoid it). Accept the terms if asked.
2. Top bar → project picker → **New project** → name `Natik` → **Create**, then make sure it is the selected project.
3. Menu → **APIs & Services** → **OAuth consent screen** (newer screens call it **Google Auth Platform**) → **Get started**:
   - App name: `Natik Language Centre`. User support email: your email.
   - Audience: **External**.
   - Contact email: your email. Agree to the policy → **Create**.
4. **Data access** (or **Scopes**) → add only these three: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. They are the
   basic ones: Google needs **no review** for them.
5. **Audience** → **Publish app** → confirm. While it says "Testing", only people you list can sign in and their sign-in expires
   after 7 days. "In production" has no such limit and, with just the three basic scopes, needs no verification.
6. **Branding** (optional): upload the logo so the Google screen looks familiar.

## 2. Create the sign-in key

1. **Clients** (or **Credentials** → **Create credentials** → **OAuth client ID**) → **Create client** → type **Web application** →
   name `Natik website`.
2. **Authorized redirect URIs** → **Add URI**, once for each address people use (they must match exactly, including `https` and no
   trailing slash):
   - `https://natik-jet.vercel.app/api/v1/auth/google/callback` (the pilot website; use your real website address)
   - `http://localhost:3000/api/v1/auth/google/callback` (your own computer, optional)
3. **Create**. Copy the **Client ID** and the **Client secret**. Treat the secret like a password: never put it in git or a chat.

## 3. Give it to the API

On **Render** → `natik-api` → **Environment** → **Add environment variable**:

| Key                    | Value                                                 |
| ---------------------- | ----------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | the Client ID (ends in `.apps.googleusercontent.com`) |
| `GOOGLE_CLIENT_SECRET` | the Client secret                                     |

Also check that `APP_URL` is exactly the website address (`https://natik-jet.vercel.app`): the "come back here" address sent to Google
is built from it, and it must be one of the redirect URIs from step 2. **Save changes**; Render restarts the API. (The Blueprint only
asks for these when the service is first created, so on an existing service add them by hand as above.)

## 4. Try it

1. Open the website in a private window → **Sign in** → **Continue with Google** → choose an account → accept the Terms → you land on
   the dashboard.
2. Sign out, press **Continue with Google** again: you go straight in.
3. Admin → Users → add a teacher with a Gmail address, then sign in with Google using that Gmail: it connects and opens `/teach`.

## When the website address changes (own domain)

Add the new `https://your-domain/api/v1/auth/google/callback` to **Authorized redirect URIs**, set `APP_URL` to the new address, and
you can remove the old URI later. Nothing else changes, and people who already use Google keep working (they are matched by Google's
own id, not by the address).

## If it does not work

| What you see                                        | Why                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| No Google button                                    | `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is empty on the API, or the API has not restarted.  |
| Google says **Error 400: redirect_uri_mismatch**    | The URI in step 2 is not exactly `APP_URL` + `/api/v1/auth/google/callback`.                     |
| Google says **access blocked / app not verified**   | The app is still in "Testing": add yourself under **Audience → Test users**, or **Publish app**. |
| Back on the sign-in page with "did not work"        | The code could not be exchanged: read the API's **Logs**. Usually a wrong client secret.         |
| "This email already has an account with a password" | Working as designed (see above): sign in with the password, then **Connect** in the Profile.     |

## On your own computer without a Google account

In `apps/api/.env` set `GOOGLE_CLIENT_ID=dev` (leave the secret empty). The API then **plays Google**: the button works and takes you
straight back. To choose which email "signs in", open
`http://localhost:3000/api/v1/auth/google/start?login_hint=someone@example.com`; an address starting with `unverified` plays a
Google email that is not verified. This is refused outside `APP_ENV=local` or `test`, so it can never be switched on by mistake on a
real site. The automated tests use it too.
