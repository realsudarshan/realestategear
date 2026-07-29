import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30000,
    // Integration tests share the realestategear_test database — run files
    // sequentially so truncation in one file can't race another.
    fileParallelism: false,
    server: {
      deps: {
        // Transform the workspace 'db' and 'search' packages (symlinked via
        // node_modules) so Vite resolves their .js-extension imports to .ts sources.
        inline: ['db', 'search'],
      },
    },
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', '**/node_modules/**', '**/*.test.ts'],
      reporter: ['text', 'lcov', 'html'],
    },
  },
});
