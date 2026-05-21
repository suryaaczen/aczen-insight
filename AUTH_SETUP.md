# Google OAuth setup (via Supabase)

This guide walks through wiring Google Sign-In into Aczen. The app code is
already in place — you just need to configure two consoles.

There are **two different "redirect URI" fields** people confuse. They are not
the same value:

| Field | Where you set it | Value |
| --- | --- | --- |
| **Google Cloud → Authorized redirect URIs** | Google Cloud Console → APIs & Services → Credentials → your OAuth client | `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` |
| **Supabase → Redirect URLs** | Supabase Studio → Authentication → URL Configuration | `http://localhost:3000/auth/callback`, `https://yourdomain.com/auth/callback` |

Google hands the user back to **Supabase**, then Supabase hands them back to
**your app**. That's why there are two layers of redirect URLs.

---

## 1. Google Cloud Console

1. Open https://console.cloud.google.com/.
2. Create (or pick) a project. Name doesn't matter.
3. **APIs & Services → OAuth consent screen**
   - User type: **External**.
   - App name: `Aczen`. Support email: your email.
   - Scopes: leave defaults (`email`, `profile`, `openid` will be requested).
   - Test users: add your own Gmail while the app is in "Testing".
   - You don't need to publish/verify yet — testing mode supports up to 100 users.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**.
   - Name: `Aczen Web`.
   - **Authorized JavaScript origins** (optional but recommended):
     - `http://localhost:3000`
     - `https://yourdomain.com` (your prod domain)
   - **Authorized redirect URIs** — this is the one you asked about:
     ```
     https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
     ```
     Replace `YOUR-PROJECT-REF` with your actual Supabase project ref (visible
     in your Supabase URL, e.g. `abcdxyz` from `https://abcdxyz.supabase.co`).
     **Do not** put `http://localhost:3000/auth/callback` here — that belongs
     in Supabase, not Google.
5. Click **Create**. Copy the **Client ID** and **Client secret**.

## 2. Supabase Studio

1. Open your project at https://supabase.com/dashboard/project/YOUR-PROJECT-REF.
2. **Authentication → Providers → Google**
   - Enable Google.
   - Paste **Client ID** and **Client secret** from step 1.
   - Save.
3. **Authentication → URL Configuration**
   - **Site URL**: `http://localhost:3000` for dev (or your prod URL).
   - **Redirect URLs** (allowlist — add one per line):
     ```
     http://localhost:3000/auth/callback
     http://localhost:3000/**
     https://yourdomain.com/auth/callback
     https://yourdomain.com/**
     ```
   - The `/**` wildcards are optional but useful if you ever change the
     callback path.

## 3. Run the migrations

```bash
supabase db push           # applies migrations/20260520_004_share_and_auth.sql
```

This adds the `share_token` column and the auth-aware RLS policies, plus the
`claim_session_conversations()` RPC that re-keys anonymous chats to a user on
first sign-in.

## 4. Test the flow

1. `npm run dev`
2. Open http://localhost:3000.
3. Send a message as anonymous — verify it shows up in **Recents**.
4. Click **Sign in with Google** in the sidebar footer.
5. After redirect you should land on `/auth/callback` briefly, then back at `/`.
6. The previously-anonymous chat should now be tied to your account
   (visible in Recents after sign-in/sign-out cycles).
7. Hover a chat → ⋯ → **Share** → copy the link → open in incognito to verify
   the read-only view at `/share/<token>`.

## Troubleshooting

- **`redirect_uri_mismatch` from Google** — the URI in the Google OAuth client
  must be **exactly** `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`.
  No trailing slash, no `localhost` here.
- **"Invalid redirect URL" from Supabase** — your `redirectTo` (i.e.
  `http://localhost:3000/auth/callback`) isn't in Supabase's Redirect URLs
  allowlist. Add it under **Authentication → URL Configuration**.
- **Avatar doesn't load** — Google enforces a referrer policy. The
  `<img referrerPolicy="no-referrer" />` in `AccountMenu.tsx` handles this.
- **"Sign in" button does nothing in prod** — check the browser console. The
  most common cause is `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` not being
  baked into the production build.
