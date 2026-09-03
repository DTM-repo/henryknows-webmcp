import { json, emailFromAuth, paidTier, stripeClient, priceId, yearlyPriceId, studentPriceId } from "./_shared/lib.js";

// Server-created Checkout Session with the email LOCKED to the signed-in user,
// so the Stripe customer always matches the app account (the old static payment
// link couldn't guarantee this, which is why paid status never mapped back).
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const email = emailFromAuth(req);
  if (!email) return json({ error: "Please sign in before upgrading." }, 401);

  // Never let an already-subscribed account start a second subscription.
  const existingTier = await paidTier(email);
  if (existingTier === "basic") {
    return json({ error: "You already have unlimited access.", alreadyPaid: true }, 409);
  }
  if (existingTier === "student") {
    return json({ error: "You already have a Student subscription. Use Manage subscription in the account menu to switch plans — the upgrade is prorated automatically.", alreadyPaid: true }, 409);
  }

  const site = process.env.SITE_URL || "https://henryknows.info";

  // {plan: "monthly"|"yearly"|"student"} selects the subscription.
  let plan = "monthly";
  try {
    const body = await req.json();
    if (body && ["yearly", "student"].includes(body.plan)) plan = body.plan;
  } catch { /* empty body = monthly */ }
  const price =
    plan === "yearly" ? yearlyPriceId() :
    plan === "student" ? studentPriceId() :
    priceId();
  if (!price) {
    return json({ error: "That plan isn't available right now — monthly is.", planUnavailable: true }, 409);
  }

  try {
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      metadata: { product: "henryknows", plan },
      line_items: [{ price, quantity: 1 }],
      customer_email: email,
      client_reference_id: email,
      allow_promotion_codes: true,
      success_url: `${site}/?upgraded=1`,
      cancel_url: `${site}/`,
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
};
