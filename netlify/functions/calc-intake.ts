// Wrapper: exposes the Duration Mapper's intake function on this site.
// The implementation lives in calculator/netlify/functions/ (the HenryKnows
// copy of the F-1 Duration Mapper); esbuild bundles it from there.
// config must be a literal here — Netlify's route detection reads this file statically.
export { default } from "../../calculator/netlify/functions/intake";
export const config = { path: "/api/intake" };
