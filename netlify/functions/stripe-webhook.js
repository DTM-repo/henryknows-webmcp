import { stripeClient, webhookSecret, setPaid, tierForSubscription } from "./_shared/lib.js";

// Closes the loop: when a subscription is created/updated/canceled, record the
// paid status (keyed by email) so chat-proxy can grant/revoke unlimited access.
export default async (req) => {
  const stripe = stripeClient();
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text(); // raw body required for signature verification

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret());
  } catch (e) {
    return new Response(`Webhook signature error: ${e.message}`, { status: 400 });
  }

  try {
    const obj = event.data.object;
    if (event.type === "checkout.session.completed") {
      const email = (
        obj.customer_email ||
        obj.customer_details?.email ||
        obj.client_reference_id ||
        ""
      ).toLowerCase();
      if (email && obj.subscription) {
        // The session object doesn't carry the price; read it off the
        // subscription. This webhook receives events for EVERY product on
        // this shared Stripe account — only record Henry subscriptions.
        let tier = null;
        try {
          const sub = await stripe.subscriptions.retrieve(obj.subscription);
          tier = tierForSubscription(sub);
        } catch {
          // Retrieval hiccup: only assume Henry when the session says so.
          if (obj.metadata?.product === "henryknows") tier = "basic";
        }
        if (tier) {
          await setPaid(email, {
            v: 2,
            status: "active",
            tier,
            customerId: obj.customer,
            subscriptionId: obj.subscription,
          });
        }
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      const cust = await stripe.customers.retrieve(obj.customer);
      const email = (cust && !cust.deleted ? cust.email : "")?.toLowerCase();
      if (email) {
        // Shared Stripe account: skip subscriptions that aren't Henry's.
        const tier = tierForSubscription(obj);
        if (tier) {
          const active = obj.status === "active" || obj.status === "trialing";
          await setPaid(email, {
            v: 2,
            status: active ? "active" : "inactive",
            tier,
            customerId: obj.customer,
            subscriptionId: obj.id,
            currentPeriodEnd: obj.current_period_end,
          });
        }
      }
    }
  } catch (e) {
    return new Response(`Handler error: ${e.message}`, { status: 500 });
  }
  return new Response("ok", { status: 200 });
};
