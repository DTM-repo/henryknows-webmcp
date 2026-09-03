# Netlify Functions (rebuilt 2026-06-20)

v2 ESM functions (Node 22). Shared helpers live in `_shared/lib.js` and `_shared/history.js`.
Quota, paid state, sign-in codes, and 7-day chat history live in Netlify Blobs;
sessions are signed JWTs (`JWT_SECRET`).

| Function | Purpose |
|---|---|
| `chat-proxy` | Forwards to the Chatbase agent. Enforces quota/paid **server-side** from the JWT session (not the client's claims). Returns `{gated:true}` when a registered free user is over the monthly limit. |
| `chat-history` | Signed-in account history: list/load/delete recent chats, with 7-day rolling retention. |
| `check-message-count` | Returns tier/usage/paid for the badge + paywall refresh. |
| `send-code` | Emails a 6-digit, 15-min sign-in code via Resend (same-tab, no link/tab-switch). |
| `verify-code` | Verifies the code (single-use, 5-attempt cap), mints a 30-day **session** JWT. |
| `google-verify` | Verifies the Google ID token **server-side**, mints a session JWT. |
| `create-checkout` | Server-created Stripe Checkout Session with the email **locked** to the signed-in user. |
| `stripe-webhook` | Subscription created/updated/canceled → writes paid status to Blobs (closes the loop). |

## Tiers
- **Anonymous:** answered; soft-gated by the frontend at 3 (no hard server gate — see below).
- **Registered (signed in):** `REGISTERED_MONTHLY_LIMIT` (default 10, env-overridable) per month, enforced in Blobs.
- **Paid:** unlimited. Paid = active Stripe subscription, resolved by the webhook store with a live Stripe lookup-by-email as a safety net.

## Stripe mode
`STRIPE_TEST_SECRET_KEY` (when present) wins over `STRIPE_SECRET_KEY`, so dev/staging never
touch live money. Test price `STRIPE_TEST_PRICE_ID`; live falls back to the known live price.
Going live = remove/clear the test key + set the webhook secret.

## Verified locally (2026-06-20, `netlify dev`)
JWT roundtrip + tamper rejection; **code sign-in** (email→code→session, single-use, wrong-code
rejected); Google bad-token → 401; anonymous chat answers via Chatbase; **registered gate fires
at the limit**; checkout requires a session and returns a `cs_test_` URL; **paid subscriber is
never gated**. Frontend (`public/index.html`) wired to send the session JWT and use all of the above.

## Verified locally (2026-06-30, `netlify dev`)
Signed-in history smoke passed: list returned 200, `chat-proxy` saved a new conversation,
list-after-save included it, get returned messages, and delete removed it.

## Operating notes
- Stripe live checkout/webhook is production-deployed and manually confirmed.
- Anonymous tier is intentionally soft (campus-shared IPs make IP gating risky). The revenue
  gate (registered→paid) is the hard, server-enforced one.
- Deploy functions + frontend together; the frontend and function contracts are intentionally paired.
