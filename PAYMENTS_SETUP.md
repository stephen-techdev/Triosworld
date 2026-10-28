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
| Razorpay hosted checkout (UPI, cards, netbanking) | `supabase/functions/trios-pay/index.ts` + `src/lib/razorpayCheckout.ts` |
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
Email:    admin@triosworld.com
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
npx supabase db push --project-ref clvwowrplnkwkiotriiu
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
| `PAYMENT_DEMO_MODE` | optional | Force demo mode even with gateway keys present (never enable in production) |
| `PAYMENT_DEBUG` | optional | Verbose payment diagnostics; keep `false` in production |
| `RAZORPAY_UPI_INTENT_ENABLED` | optional | Enables the gated S2S UPI-intent QR path; keep unset/false until Razorpay enables UPI Intent on the account |
| `ADMIN_SESSION_SECRET` | optional | Signing key for admin sessions (defaults to the service role key) |

```bash
npx supabase secrets set \
  RAZORPAY_KEY_ID=rzp_live_xxxxxxxx \
  RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx \
  RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx \
  PAYMENT_DEBUG=false \
  --project-ref clvwowrplnkwkiotriiu
```

Do **not** set `UPI_VPA`: the raw personal-UPI fallback is disabled in live mode.
Payments must go through Razorpay so the server can verify them. The legacy
secret may still exist on old projects; unset it with
`npx supabase secrets unset UPI_VPA --project-ref clvwowrplnkwkiotriiu`.

### 3.3 Deploy the edge functions

```bash
npx supabase functions deploy trios-pay   --project-ref clvwowrplnkwkiotriiu --no-verify-jwt
npx supabase functions deploy trios-admin --project-ref clvwowrplnkwkiotriiu --no-verify-jwt
npx supabase functions deploy trios-auth  --project-ref clvwowrplnkwkiotriiu --no-verify-jwt
```

`--no-verify-jwt` is required: guests must be able to pay, and the webhook and
admin API authenticate with their own signatures/tokens.

> **Deploy the backend before the frontend.** The new checkout creates orders
> through `trios-pay`; until that function and the migration exist, checkout
> will report that it could not start the payment.

### 3.4 Configure the Razorpay webhook

In the Razorpay dashboard → **Settings → Webhooks**, add:

```
https://clvwowrplnkwkiotriiu.supabase.co/functions/v1/trios-pay/webhook
```

Use the same value you set as `RAZORPAY_WEBHOOK_SECRET`, and subscribe to:

- `payment.captured`
- `payment.failed`
- `order.paid`

Every callback is rejected unless its `X-Razorpay-Signature` matches an
HMAC-SHA256 of the raw body, compared in constant time. `qr_code.credited` is
not offered as a webhook event on accounts without the on-demand UPI QR
feature; hosted checkout works without it.

### 3.5 Website origin and failed-payment reconciliation

Razorpay live payments are only allowed from the website approved on the
account. The approved live origin for this store is **`https://www.triosworld.in`**.
The order page redirects the customer there before opening Checkout if it is
running on a Vercel preview or another unapproved origin. The default production
alias `https://triosworld.vercel.app` is also redirected to the approved origin
at the Vercel edge (see `vercel.json`), so the alias cannot reach Checkout with
an unapproved `Origin` header. `/create` also stores the browser origin in the
gateway order (and `gateway_meta.checkout_origin`) so a mismatch can be traced
from Razorpay.

A `payment.failed` webhook stores the failed payment id, Razorpay's reason, and
the failure time on the order. A risk-check failure is **not** marked paid and
does not decrement stock. Razorpay's own payment page states that any amount
debited for such a failed attempt is reversed within **7 working days**; the
merchant cannot manually refund an uncaptured payment. Keep the failed payment
id for support.

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
3. The order page shows the 15-minute countdown and a **Pay securely** button.
4. Live: open **https://www.triosworld.in** (never a Vercel preview link), tap
   **Pay securely**, choose UPI in Razorpay Checkout, and pay ₹1 worth of test
   stock → the page flips to *Payment successful* on its own within ~5s. A
   checkout attempted from any other origin is redirected to the approved site
   before Razorpay opens.
5. Demo: press **Complete demo payment**.
6. Confirm: order ID, amount paid, payment method, payment date, status = PAID.
7. **Download receipt** → check the PDF (branding, customer, items, GST split,
   total, transaction reference).
8. Refresh the page — it still works (the token is in the URL).

**Failure states**

* Open the payment window and close it without paying → after 15 minutes the
  page shows *Payment window closed* with no money taken.
* A `payment.failed` webhook (or "Mark failed") shows the retry screen. If
  Razorpay blocked it at the website risk check, the page shows the Razorpay
  payment reference and the 7-working-day auto-reversal note; the order is not
  captured and stock is not decremented.

**Receipt protection**

* Change one character of `?token=` in the URL → *Receipt not found*.
* Request a receipt for a pending order → *A receipt is available once the
  payment is confirmed.*

**Admin**

1. `/login` → enter `admin@triosworld.com` → **OPEN DASHBOARD**.
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
* **Stock is decremented only after a verified payment.** The
  `decrement_variant_stock` RPC is atomic per colour/size and idempotent through
  the paid transition, so retried webhooks cannot double-decrement. The storefront
  still caps quantity to the selected size's stock.
* **Wildcard CORS** (`*`) on the functions, unchanged from the existing setup.
