import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    tailwindcss(),
    {
      name: 'stub-virtual-modules',
      resolveId(id) {
        if (
          id === '#tanstack-start-entry' ||
          id === '#tanstack-router-entry' ||
          id === '#tanstack-start-plugin-adapters' ||
          id === 'tanstack-start-manifest:v' ||
          id === '@tanstack/server-fn-runtime' ||
          id.startsWith('nitro/')
        ) {
          return '\0' + id
        }
        return null
      },
      load(id) {
        if (id === '\0#tanstack-start-entry') {
          return 'export var startInstance = void 0;'
        }
        if (id === '\0#tanstack-router-entry') {
          return 'export function getRouter() {}'
        }
        if (id === '\0#tanstack-start-plugin-adapters') {
          return 'export var pluginSerializationAdapters = []; export var hasPluginAdapters = false;'
        }
        if (id === '\0tanstack-start-manifest:v') {
          return 'export function tsrStartManifest() { return { routes: {}, scriptFormat: "module" }; }'
        }
        if (id === '\0@tanstack/server-fn-runtime') {
          return 'export function createServerReference() { return {}; } export function createServerFn() { return {}; }'
        }
        if (id.startsWith('\0nitro/')) {
          return 'export default {}'
        }
        return null
      },
    },
  ],
  resolve: {
    alias: {
      '#tanstack-start-entry': '/home/openclaw/rental-rosy-realm/src/stubs/tanstack-start-entry.js',
      '#tanstack-router-entry': '/home/openclaw/rental-rosy-realm/src/stubs/tanstack-router-entry.js',
      '#tanstack-start-plugin-adapters': '/home/openclaw/rental-rosy-realm/node_modules/@tanstack/start-client-core/dist/esm/empty-plugin-adapters.js',
    },
  },
  build: {
    outDir: '.vercel/output/static',
    emptyOutDir: false,
    rollupOptions: {
      input: 'index.html',
    },
    cssMinify: false,
  },
})
