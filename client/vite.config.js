import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dev proxy target must match the Express `PORT` (server default 3000).
 * Order: `client/.env` VITE_API_PORT → `server/.env` PORT → 3000.
 */
function resolveApiPort(mode, cwd) {
  const env = loadEnv(mode, cwd, "");
  if (env.VITE_API_PORT && String(env.VITE_API_PORT).trim()) {
    return String(env.VITE_API_PORT).trim();
  }
  try {
    const serverEnvPath = path.join(__dirname, "..", "server", ".env");
    const text = fs.readFileSync(serverEnvPath, "utf8");
    const m = text.match(/^\s*PORT\s*=\s*(\d+)/m);
    if (m) return m[1];
  } catch {
    /* no file or unreadable */
  }
  return "3000";
}

export default defineConfig(({ mode }) => {
  const port = resolveApiPort(mode, process.cwd());
  const target = `http://127.0.0.1:${port}`;

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
        },
      },
    },
    preview: {
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
        },
      },
    },
  };
});
