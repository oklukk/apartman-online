import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { artCatalog } from './tools/art-catalog.mjs';
export default defineConfig({ plugins: [artCatalog(), react()], base: "/apartman-online/" });
