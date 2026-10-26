import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: { DB_FILE: ':memory:' },
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      reporter: ['text', 'html'],
    },
  },
})
