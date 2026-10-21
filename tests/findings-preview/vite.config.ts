// Isolated visual/interaction QA. Never part of the production entry point.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  cacheDir: local("../../node_modules/.vite-findings-preview"),
  publicDir: local("../../public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@/hooks/useAuth", replacement: local("./hooks.ts") },
      { find: "@/hooks/useWorkspace", replacement: local("./hooks.ts") },
      { find: "@/hooks/useScans", replacement: local("../workbench-preview/hooks.ts") },
      { find: "@/lib/supabase", replacement: local("./supabase.ts") },
      { find: "@", replacement: local("../../src") },
    ],
  },
  server: { host: "127.0.0.1", port: 5176, strictPort: true },
});
