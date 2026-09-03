import { json, emailFromAuth, getUsage, paidTier, REGISTERED_MONTHLY_LIMIT, STUDENT_MONTHLY_LIMIT } from "./_shared/lib.js";

// Single source of truth for the badge / paywall refresh: tier, usage, paid.
// Tiers: anonymous | registered (3/mo free) | student ($10/mo, 20/mo) | paid (basic, unlimited).
export default async (req) => {
  const email = emailFromAuth(req);
  if (!email) return json({ tier: "anonymous" });

  const tier = await paidTier(email);
  if (tier === "basic") return json({ tier: "paid", email, paid: true });

  const limit = tier === "student" ? STUDENT_MONTHLY_LIMIT : REGISTERED_MONTHLY_LIMIT;
  const used = await getUsage(email);
  return json({
    tier: tier === "student" ? "student" : "registered",
    email,
    paid: false,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  });
};
