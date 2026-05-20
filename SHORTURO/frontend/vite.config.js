import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    define: {
      __GOOGLE_CLIENT_ID__: JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || "")
    },
    server: {
      port: 5173,
      headers: {
        // Google Identity Services uses popups + postMessage; a strict COOP (e.g. "same-origin")
        // can break the flow by isolating the browsing context group.
        "Cross-Origin-Opener-Policy": "unsafe-none",
        "Cross-Origin-Embedder-Policy": "unsafe-none"
      }
    },
    preview: {
      headers: {
        "Cross-Origin-Opener-Policy": "unsafe-none",
        "Cross-Origin-Embedder-Policy": "unsafe-none"
      }
    }
  };
});
