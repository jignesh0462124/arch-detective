import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  cacheDir: local("../../node_modules/.vite-auth-preview"),
  publicDir: local("../../public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^(?:@\/lib\/supabase|\.\.\/supabase)$/, replacement: local("./supabase.ts") },
      { find: "@/lib/api/prefetch", replacement: local("./prefetch.ts") },
      { find: "@", replacement: local("../../src") },
    ],
  },
  server: { host: "127.0.0.1", port: 5178, strictPort: true },
});
