import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// This is the HenryKnows copy of the F-1 Duration Mapper. It is served from
// henryknows.info/new-duration-rules-calculator/, so assets must resolve
// relative to that base, and the build lands inside the site's publish dir.
export default defineConfig({
  plugins: [react()],
  base: "/new-duration-rules-calculator/",
  build: {
    outDir: "../public/new-duration-rules-calculator",
    emptyOutDir: true
  },
  server: {
    port: 5177
  }
});
