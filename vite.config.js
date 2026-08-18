import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  // Set base path for GitHub Pages (project site) so assets load from /codespaces-react/
  base: '/codespaces-react/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
