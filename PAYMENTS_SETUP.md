# TriosWorld — UPI Payments, Admin Dashboard & Feedback

Everything in this document is already implemented in the code. The steps under
**Required setup** are the parts that need credentials only you can create.

---

## 1. What was built

| Requirement | Where it lives |
|---|---|
| Guest checkout + optional login/register | `src/pages/CheckoutPage.tsx` |
| Collect name, mobile, delivery address | `CheckoutPage.tsx` → validated again server-side |
| No OTP / no email or SMS verification | Never added anywhere |
| UPI gateway with **dynamic QR** | `supabase/functions/trios-pay/index.ts` |
| Backend verification + signed webhooks | `trios-pay` `/status` (polls gateway) and `/webhook` (HMAC SHA-256) |
| Never "success" from a frontend button | Only the server writes `payment_status = 'paid'` |
| Auto-update order to PAID | `markPaid()` in `trios-pay` |
| Payment Successful page | `src/pages/PaymentSuccessPage.tsx` (`/order/:orderNumber`) |
| Order ID, amount, method, date, status | Same page |
| Download Receipt button | `src/lib/receipt.ts` (jsPDF) |
| Professional PDF receipt | Branding, customer, items, qty, prices, GST, total, payment ref |
| Receipts only for verified paid orders | `trios-pay` `/receipt` returns 403 otherwise |
| Guest download without an account | Receipt token, no login required |
| Unguessable order access token | `orders.receipt_token` — 32 hex chars from `crypto.getRandomValues` |
| Verified order saved for admin | `orders` + `order_events` tables |
| pending / failed / delayed handling | `pending`, `failed`, `expired`, plus the event trail |
| Existing UI preserved | Checkout restyled only; nothing else rebuilt |
| Admin dashboard | `src/pages/admin/AdminPage.tsx` (`/admin`) |
| Admin login via the customer login page | Type the admin **email** in the login field |
| Product cards, edit/view | `/admin` → Products |
| Guest account management | `/admin` → Customers |
| Payments | `/admin` → Orders & Payments |
| Feedback icon + storage in dashboard | `src/components/FeedbackWidget.tsx` → `/admin` → Feedback |

### Security model (important)

* **Orders are created by the edge function, with the service role — never by
  the browser.** This also fixes a real hole in the old checkout, which inserted
  orders straight from the browser; `orders` has no client `INSERT` policy.
* **Prices are recomputed on the server** from
  `supabase/functions/_shared/prices.ts`, which is generated from
  `src/data/catalog.ts`. A tampered client payload cannot change what the
  customer owes. Regenerate it after editing the catalogue:

  ```bash
  node scripts/sync-prices.mjs
  ```

* **"Paid" is written in exactly one place**, after either a signature-verified
  webhook or a re-query of the gateway. Underpayments are rejected.
* The `admins` table has RLS enabled with **no policies at all**, so it is
  unreachable from the browser even for signed-in customers.
* `feedback` is **INSERT-only** for the public — submissions can be sent but not
  listed from the client.

---

## 2. Default admin credentials

Created by the migration:

```
Email:    admin@triosworld.in
Password: Trios@Admin2026
```

**Change it immediately** after your first login: `/admin` → **Settings** →
Change password. (Requires at least 10 characters with a letter and a number.)

To seed a different hash, generate one and replace it in the migration:

```bash
node scripts/hash-password.mjs 'YourNewPassword'
```

**How to sign in:** open `/login` on the storefront and type the admin **email**
into the field where customers type their mobile number. The page detects the
`@` and switches to admin mode, then redirects to `/admin`. You can also go
straight to `/admin`.

---

## 3. Required setup

### 3.1 Apply the database migration

```bash
npx supabase db push --project-ref gaslxkkupksrmecodsrm
```

Or paste `supabase/migrations/20261017120000_payments_admin_feedback.sql` into
the Supabase SQL editor and run it.

This creates/extends: `orders` (guest + payment + receipt columns),
`order_events`, `admins` (with the default admin), `feedback`,
`product_overrides`.

### 3.2 Set the function secrets

| Secret | Required? | Purpose |
|---|---|---|
| `RAZORPAY_KEY_ID` | for live payments | Razorpay key id |
| `RAZORPAY_KEY_SECRET` | for live payments | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | for live payments | Verifies webhook signatures |
| `UPI_VPA` | optional | Your UPI ID, used if the gateway cannot issue a QR |
| `UPI_PAYEE_NAME` | optional | Payee name shown in the UPI intent (default `TriosWorld`) |
| `PAYMENT_DEMO_MODE` | optional | Force demo mode even with gateway keys present |
| `ADMIN_SESSION_SECRET` | optional | Signing key for admin sessions (defaults to the service role key) |

```bash
npx supabase secrets set \
  RAZORPAY_KEY_ID=rzp_live_xxxxxxxx \
  RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx \
  RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx \
  UPI_VPA=yourshop@okhdfcbank \
  UPI_PAYEE_NAME=TriosWorld \
  --project-ref gaslxkkupksrmecodsrm
```

### 3.3 Deploy the edge functions

```bash
npx supabase functions deploy trios-pay   --project-ref gaslxkkupksrmecodsrm --no-verify-jwt
npx supabase functions deploy trios-admin --project-ref gaslxkkupksrmecodsrm --no-verify-jwt
npx supabase functions deploy trios-auth  --project-ref gaslxkkupksrmecodsrm --no-verify-jwt
```

`--no-verify-jwt` is required: guests must be able to pay, and the webhook and
admin API authenticate with their own signatures/tokens.

> **Deploy the backend before the frontend.** The new checkout creates orders
> through `trios-pay`; until that function and the migration exist, checkout
> will report that it could not start the payment.

### 3.4 Configure the Razorpay webhook

In the Razorpay dashboard → **Settings → Webhooks**, add:

```
https://gaslxkkupksrmecodsrm.supabase.co/functions/v1/trios-pay/webhook
```

Use the same value you set as `RAZORPAY_WEBHOOK_SECRET`, and subscribe to:

- `payment.captured`
- `payment.failed`
- `order.paid`
- `qr_code.credited`

Every callback is rejected unless its `X-Razorpay-Signature` matches an
HMAC-SHA256 of the raw body, compared in constant time.

---

## 4. Demo mode (what happens with no gateway keys)

If `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are absent, the store cannot take
real money — so it says so rather than pretending:

* `/create` returns `payment.demo = true`, and the payment screen shows a
  **Demo mode** panel.
* Settlement happens through `POST /demo-settle`, which is a **server-side**
  state change with a synthetic reference (`DEMO-XXXXXXXX`). It is disabled the
  moment real gateway keys are configured.
* The success page and the PDF receipt are both clearly stamped
  **DEMO PAYMENT — NOT A REAL TRANSACTION**.

This keeps the whole flow demoable end-to-end without ever showing a fake
"Payment Successful" for a payment that did not happen.

---

## 5. Testing checklist

**Payment flow**

1. Add an item to the bag → Checkout (no sign-in).
2. Fill name, mobile, address → **Pay securely**.
3. The order page shows a UPI QR and a 15-minute countdown.
4. Live: scan with a real UPI app and pay ₹1 worth of test stock → the page
   flips to *Payment successful* on its own within ~5s.
5. Demo: press **Complete demo payment**.
6. Confirm: order ID, amount paid, payment method, payment date, status = PAID.
7. **Download receipt** → check the PDF (branding, customer, items, GST split,
   total, transaction reference).
8. Refresh the page — it still works (the token is in the URL).

**Failure states**

* Leave the QR unscanned → after 15 minutes the page shows *Payment window
  closed* with no money taken.
* A `payment.failed` webhook (or "Mark failed") shows the retry screen.

**Receipt protection**

* Change one character of `?token=` in the URL → *Receipt not found*.
* Request a receipt for a pending order → *A receipt is available once the
  payment is confirmed.*

**Admin**

1. `/login` → enter `admin@triosworld.in` → **OPEN DASHBOARD**.
2. Overview shows revenue/orders/feedback counts.
3. Orders & Payments: filter, search, open an order, change fulfilment status,
   inspect the payment trail.
4. Products: change a price and a stock number → **Save changes** → reload the
   storefront and confirm the new price appears. (The server also charges the
   new price.)
5. Customers: guests and registered accounts with order counts and spend.
6. Feedback: submit from the storefront's floating button → it appears here with
   the rating; move it new → read → resolved.
7. Settings: change the admin password, sign out, sign back in.

---

## 6. Known limitations (honest list)

* **Feedback spam**: the public INSERT policy has no rate limit. Add
  Turnstile/reCAPTCHA or move submissions through an edge function if the store
  gets targeted.
* **Cart and wishlist are localStorage-only**, so they do not follow a customer
  between devices.
* **The main JS bundle is still ~620 kB.** The order page (jsPDF + QRCode) and
  the dashboard are code-split, but the storefront itself is one chunk.
* **`product_overrides` is public-read** (prices are public anyway) and
  service-role-write.
* **Stock is not decremented on payment.** The server validates available stock
  before creating a payment, but two simultaneous buyers can still oversell the
  last unit. Add a `decrement_stock` trigger/RPC if that matters.
* **Wildcard CORS** (`*`) on the functions, unchanged from the existing setup.
