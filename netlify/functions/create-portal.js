import { json, emailFromAuth, paidTier, getPaidRecord, stripeClient } from "./_shared/lib.js";

// Self-serve subscription management: cancel, switch between Student and
// Basic (monthly/yearly, prorated), update card, view invoices — via Stripe's
// hosted Billing Portal, so nobody has to email us to change plans.
const PORTAL_CONFIGURATION =
  process.env.STRIPE_PORTAL_CONFIGURATION || "bpc_1U59OXHHDGTnfrvWFK8c0O4H";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const email = emailFromAuth(req);
  if (!email) return json({ error: "Please sign in first." }, 401);

  // paidTier() refreshes the record from Stripe if the webhook was missed,
  // so the customerId is populated for any active subscriber.
  const tier = await paidTier(email);
  if (!tier) return json({ error: "No active subscription on this account.", noSubscription: true }, 404);
  const rec = await getPaidRecord(email);
  if (!rec?.customerId) return json({ error: "We couldn't locate your billing record — contact us and we'll fix it." }, 500);

  const site = process.env.SITE_URL || "https://henryknows.info";
  try {
    const stripe = stripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: rec.customerId,
      configuration: PORTAL_CONFIGURATION,
      return_url: `${site}/`,
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
};
