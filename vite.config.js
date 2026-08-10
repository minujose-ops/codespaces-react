import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/codespaces-react/' : '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
