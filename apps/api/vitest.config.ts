import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test-setup.ts'],
    testTimeout: 30000,
    // Integration tests share a PostgreSQL database — run files sequentially to
    // prevent unique-constraint races between concurrent workers.
    fileParallelism: false,
    server: {
      deps: {
        // Transform the workspace 'db' package (symlinked via node_modules/db →
        // packages/db) so Vite resolves .js extension imports to .ts sources.
        inline: ['db'],
      },
    },
    coverage: {
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/server.{js,ts}', '**/node_modules/**', '**/__tests__/**'],
      reporter: ['text', 'lcov', 'html'],
    },
  },
});
