import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "../public/advising",
    emptyOutDir: true,
    lib: {
      entry: "src/preparation/index.tsx",
      formats: ["es"],
      fileName: () => "preparation.js",
      cssFileName: "preparation",
    },
  },
});
