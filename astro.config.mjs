// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import svelte from "@astrojs/svelte";
import node from "@astrojs/node";
import { EventEmitter } from "events";

EventEmitter.defaultMaxListeners = 20;

// https://astro.build/config
export default defineConfig({
  security: {
      checkOrigin: false,
  },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
      ],
    },
    server: {
      watch: {
        ignored: [
          "/storage/**",
          '**/.astro/**',
          '**/.vercel/**',
          '**/.vscode/**',
          '**/backups/**',
          '**/drizzle/**',
          '**/logs/**',
          '**/playwright-report/**',
          '**/test-results/**',
          '**/tests/**',
          '**/scripts/**',
          '**/node_modules/**',
        ],
      },
    },
  },
  output: "server",
  integrations: [ svelte({ extensions: [".svelte"] }) ],

  prefetch: {
    defaultStrategy: "hover",
    prefetchAll: false,
  },
  adapter: node({ mode: "standalone" }),
})
