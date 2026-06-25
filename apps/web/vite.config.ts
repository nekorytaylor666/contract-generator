import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  envDir: "../..",
  plugins: [tsconfigPaths(), tailwindcss(), TanStackRouterVite(), viteReact()],
  server: {
    port: 3001,
    // Listen on all interfaces so both localhost and 127.0.0.1 (IPv4) work —
    // by default Vite binds a single loopback (often IPv6 ::1), which makes
    // http://127.0.0.1:3001 connection-refused.
    host: true,
  },
});
