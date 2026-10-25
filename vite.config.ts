import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5188, strictPort: true, proxy: { "/api": "http://localhost:4021", "/premium": "http://localhost:4021", "/sponsor": "http://localhost:4021" } },
  build: { outDir: "dist" }
});
