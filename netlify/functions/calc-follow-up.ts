// Wrapper: exposes the Duration Mapper's rule-scoped follow-up function on this site.
// config must be a literal here — Netlify's route detection reads this file statically.
export { default } from "../../calculator/netlify/functions/follow-up";
export const config = { path: "/api/follow-up" };
