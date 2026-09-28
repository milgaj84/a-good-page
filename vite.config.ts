import { defineConfig } from 'vitest/config';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  // Modern WebViews only: no down-levelling, smaller and faster bundles.
  build: { target: 'es2021', cssCodeSplit: false, reportCompressedSize: false },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
