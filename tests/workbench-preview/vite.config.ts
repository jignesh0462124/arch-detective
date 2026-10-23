// Isolated visual QA only. This config is never imported by the application build.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { entries: ["tests/workbench-preview/index.html"] },
  resolve: {
    alias: [
      { find: "@/hooks/useAuth", replacement: local("./hooks.ts") },
      { find: "@/hooks/useWorkspace", replacement: local("./hooks.ts") },
      { find: "@/hooks/useScans", replacement: local("./hooks.ts") },
      { find: "@/lib/supabase", replacement: local("./supabase.ts") },
      { find: "@", replacement: local("../../src") },
    ],
  },
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
});
