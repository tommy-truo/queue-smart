import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: { DB_FILE: ':memory:' },
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      reporter: ['text', 'html'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
})
