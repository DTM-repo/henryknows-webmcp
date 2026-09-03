// Wrapper: exposes the Duration Mapper's advisor-report function on this site.
// config must be a literal here — Netlify's route detection reads this file statically.
export { default } from "../../calculator/netlify/functions/explain";
export const config = { path: "/api/explain" };
