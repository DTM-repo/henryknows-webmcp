// Shared helpers for HenryKnows functions.
import jwt from "jsonwebtoken";
import { getStore } from "@netlify/blobs";
import Stripe from "stripe";

const JWT_SECRET = process.env.JWT_SECRET;

// Free signed-in accounts: 3 questions/month (David, 2026-08-16 — was 10).
export const REGISTERED_MONTHLY_LIMIT = parseInt(
  process.env.REGISTERED_MONTHLY_LIMIT || "3",
  10
);
// Henry Student ($10/mo): 20 questions/month.
export const STUDENT_MONTHLY_LIMIT = parseInt(
  process.env.STUDENT_MONTHLY_LIMIT || "20",
  10
);
export const GOOGLE_CLIENT_ID =
  "914021283229-60975bn54bs5feqflv45mtegfi8oqsd2.apps.googleusercontent.com";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Stripe (test key wins when present, so dev never touches live money) ──
export function usingTestStripe() {
  return !!process.env.STRIPE_TEST_SECRET_KEY;
}
export function stripeClient() {
  const key = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  return new Stripe(key);
}
export function priceId() {
  return usingTestStripe()
    ? process.env.STRIPE_TEST_PRICE_ID
    : process.env.STRIPE_LIVE_PRICE_ID || "price_1TP5J3HHDGTnfrvW9lzEN9LD";
}
export function yearlyPriceId() {
  return usingTestStripe()
    ? process.env.STRIPE_TEST_YEARLY_PRICE_ID || null
    : process.env.STRIPE_LIVE_YEARLY_PRICE_ID || "price_1U55q8HHDGTnfrvWwj7V9agO";
}
export function studentPriceId() {
  return usingTestStripe()
    ? process.env.STRIPE_TEST_STUDENT_PRICE_ID || null
    : process.env.STRIPE_LIVE_STUDENT_PRICE_ID || "price_1U55r7HHDGTnfrvW50kWZdWx";
}

// ⚠ This Stripe account is shared with other products (On the Books, etc.).
// Henry logic must only ever look at subscriptions on HENRY's own products —
// matching by email alone once granted a Town Hall Pass buyer Henry access.
export const HENRY_PRODUCTS = {
  "prod_UNr1dwMLK01cgi": "basic",   // Henry Basic ($35/mo, $299/yr)
  "prod_V5GNNCLOacA0np": "student", // Henry Student ($10/mo)
};

// Tier for a subscription object, or null when it isn't a Henry subscription.
// Keyed by PRODUCT (not price id) so a price created later in the Dashboard
// still maps to the right tier instead of locking a payer out.
export function tierForSubscription(sub) {
  for (const item of sub?.items?.data || []) {
    const product = typeof item.price?.product === "string" ? item.price.product : item.price?.product?.id;
    if (HENRY_PRODUCTS[product]) return HENRY_PRODUCTS[product];
  }
  return null;
}

// Back-compat shim for price-id callers.
export function tierForPriceId(id) {
  if (id === studentPriceId()) return "student";
  if (id === priceId() || id === yearlyPriceId()) return "basic";
  return null;
}
export function webhookSecret() {
  return usingTestStripe()
    ? process.env.STRIPE_TEST_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET;
}

// ── Sessions (signed JWT — the server trusts these, not the client's claims) ──
export function signSession(email) {
  return jwt.sign({ email: email.toLowerCase(), kind: "session" }, JWT_SECRET, {
    expiresIn: "30d",
  });
}
export function signMagic(email) {
  return jwt.sign({ email: email.toLowerCase(), kind: "magic" }, JWT_SECRET, {
    expiresIn: "15m",
  });
}
export function verifyToken(token, kind) {
  try {
    const p = jwt.verify(token, JWT_SECRET);
    if (kind && p.kind !== kind) return null;
    return p;
  } catch {
    return null;
  }
}
export function emailFromAuth(req) {
  const h = req.headers.get("authorization") || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!t) return null;
  const p = verifyToken(t, "session");
  return p?.email?.toLowerCase() || null;
}

// ── Stores (Netlify Blobs) ──
function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
// Strong consistency: these stores are read back moments after a write from a
// different function invocation (send-code → verify-code, webhook → isPaid);
// the eventual-consistency default can serve stale reads in production.
function usageStore() {
  return getStore({ name: "usage", consistency: "strong" });
}
function codesStore() {
  return getStore({ name: "codes", consistency: "strong" });
}
function subscribersStore() {
  return getStore({ name: "subscribers", consistency: "strong" });
}

export async function getUsage(email) {
  const v = await usageStore().get(`${email.toLowerCase()}:${monthKey()}`);
  return v ? parseInt(v, 10) : 0;
}
export async function bumpUsage(email) {
  const store = usageStore();
  const key = `${email.toLowerCase()}:${monthKey()}`;
  const cur = await store.get(key);
  const next = (cur ? parseInt(cur, 10) : 0) + 1;
  await store.set(key, String(next));
  return next;
}
// ── Sign-in codes (6-digit, same-tab, no link/tab-switch) ──
export async function getCodeRecord(email) {
  return (
    (await codesStore().get(email.toLowerCase(), { type: "json" })) || null
  );
}
export async function setCodeRecord(email, rec) {
  await codesStore().setJSON(email.toLowerCase(), rec);
}
export async function clearCode(email) {
  await codesStore().delete(email.toLowerCase());
}

export async function setPaid(email, data) {
  await subscribersStore().setJSON(email.toLowerCase(), {
    ...data,
    updatedAt: Date.now(),
  });
}
export async function getPaidRecord(email) {
  return (
    (await subscribersStore().get(email.toLowerCase(), { type: "json" })) ||
    null
  );
}

// Paid tier: trust the webhook-maintained store first; fall back to a live
// Stripe lookup by email (covers missed webhooks), caching the result.
// Returns "basic" (unlimited), "student" (20/mo), or null (not subscribed).
// Records written before tiers existed carry no tier field = basic.
export async function paidTier(email) {
  const e = email.toLowerCase();
  const rec = await getPaidRecord(e);
  // v2 records are product-scoped. Older records may have been created from a
  // NON-Henry subscription on this shared Stripe account (the On the Books
  // collision) — ignore them and re-derive from Stripe, which self-heals.
  if (rec && rec.v === 2 && rec.status === "active") {
    if (!rec.currentPeriodEnd || rec.currentPeriodEnd * 1000 > Date.now()) {
      return rec.tier === "student" ? "student" : "basic";
    }
  }
  try {
    const stripe = stripeClient();
    // Checkout creates a new customer per session, so one email can map to
    // several customer objects — scan them all, but count ONLY subscriptions
    // on Henry's own products.
    const customers = await stripe.customers.list({ email: e, limit: 10 });
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 10,
        expand: ["data.items.data.price"],
      });
      for (const sub of subs.data) {
        const tier = tierForSubscription(sub);
        if (!tier) continue; // some other product's subscription
        await setPaid(e, {
          v: 2,
          status: "active",
          tier,
          customerId: customer.id,
          subscriptionId: sub.id,
          currentPeriodEnd: sub.current_period_end,
        });
        return tier;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Legacy boolean: "paid" features (unlimited questions, saved answers) are
// Basic-tier features. Student-tier accounts are paying but not "paid" here.
export async function isPaid(email) {
  return (await paidTier(email)) === "basic";
}
