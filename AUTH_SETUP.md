# TriosWorld — Authentication Setup

Mobile number + password authentication (no OTP, no email/password) with
"Continue with Google", built on Supabase Auth + a `trios-auth` edge function.

```
Frontend (React + Vite)
  ├─ /login            → WELCOME BACK. (mobile + password, Remember me, Google)
  ├─ /register         → JOIN TRIOSWORLD. (name, mobile, gender, password, confirm)
  ├─ /forgot-password  → reset via 6-digit mobile code
  └─ /account          → Profile / Orders / Wishlist / Addresses / Settings / Logout
        │  fetch()
        ▼
Edge function: supabase/functions/trios-auth  (Deno, verify_jwt = false)
  ├─ POST /register         validate → admin.createUser(phone, phone_confirm) → bcrypt hash → profile row → session
  ├─ POST /login            rate limit → bcrypt.compare → Supabase phone+password grant → session
  ├─ POST /reset-request    bcrypt-hashed 6-digit code (30 min TTL) → SMS or demo mode
  ├─ POST /reset-confirm    verify code → update bcrypt hash + Auth password
  └─ POST /complete-profile verify JWT → upsert profile (Google users)
        │
        ▼
Postgres (RLS on)
  profiles, addresses, orders, password_resets, auth_rate_limits
  + trigger on auth.users → auto-creates profiles row for Google users
```

## Required environment variables (frontend)

`.env` in the project root (already git-ignored):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## Required Supabase configuration

These are project settings, not code — the app cannot work without them:

| # | What | Why | Where |
|---|------|-----|-------|
| 1 | **Enable the Phone provider** | Mobile + password login returns `phone_provider_disabled` until this is on. No SMS is sent for login — `admin.createUser({ phone_confirm: true })` and the password grant do not send OTPs. | Dashboard → Authentication → Providers → Phone → Enable |
| 2 | **Configure Google provider** | Google sign-in is currently disabled (`google: false`). | Dashboard → Authentication → Providers → Google (Client ID + Secret) and add `<project-url>/auth/v1/callback` to the Google Cloud OAuth client's redirect URIs |
| 3 | **Redirect URLs** | OAuth + local dev redirects must be allow-listed. | Dashboard → Authentication → URL Configuration (add `http://localhost:5173/**`, `http://localhost:5174/**`, production origin) |
| 4 | **Apply migrations** | The Google-profile trigger and existing tables. | `supabase db push`, or run each file in `supabase/migrations/` in the SQL editor |
| 5 | **Deploy the edge function** | Auth API endpoint. | `supabase functions deploy trio-auth --no-verify-jwt` |

Function secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.

### Optional — real SMS for password reset

Without an SMS provider the reset endpoint runs in **demo mode**: it returns the
code in the response and the UI says so explicitly (it never claims an SMS was
sent). To send real SMS, set these function secrets (Twilio):

```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
```

Once configured, the reset code is sent by SMS and is **not** returned in the API
response.

## Security properties

- Passwords are bcrypt-hashed (`bcryptjs`, `$2b$` hashes) in `profiles.password_hash`
  and by Supabase Auth. Plaintext passwords are never stored or logged, and never
  kept in frontend storage.
- Mobile numbers are unique (DB constraint + edge-function check + Auth duplicate error).
- Login/register/reset are rate limited to 5 attempts per mobile per 15 minutes
  (`auth_rate_limits`), cleared on success.
- Login always runs a bcrypt compare (dummy hash for unknown numbers) and returns a
  single generic error, so responses don't reveal whether a number is registered.
- Sessions are Supabase JWTs. "Remember me" unchecked keeps the session in memory
  only (gone on reload); checked (default) persists it. The cart/wishlist
  (`localStorage: triosworld-store-v1`) is never touched by auth, so it survives
  login/logout.
- `profiles`, `addresses` and `orders` are protected by RLS (`auth.uid() = user_id`);
  `password_resets` and `auth_rate_limits` have no client policies at all.
- Mobile numbers are **not** claimed to be verified anywhere: no OTP is sent, and
  the UI never says "verified".

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build
npm run lint
```

## End-to-end auth tests

After the function, providers and migration are live:

```bash
node scripts/auth-e2e.mjs
```

It registers a temporary customer, checks duplicate-mobile rejection, correct /
wrong / unknown-number login, RLS reads and writes with the session, logout,
password reset (wrong + correct code), login with the new password, input
validation, and login rate limiting.

Temporary numbers used: `9000000001` and `9000000002`. Delete them afterwards
(dashboard → Authentication → Users, or):

```sql
DELETE FROM auth.users WHERE phone IN ('+919000000001', '+919000000002');
```

---

## Payments, admin dashboard & feedback

UPI payments, PDF receipts, the `/admin` dashboard, product overrides and the
customer feedback widget are documented separately in **[PAYMENTS_SETUP.md](./PAYMENTS_SETUP.md)**.

That document also contains the default admin credentials and the
`trios-pay` / `trios-admin` deployment steps, which must be completed **before**
deploying the frontend (the checkout now creates orders through `trios-pay`).
