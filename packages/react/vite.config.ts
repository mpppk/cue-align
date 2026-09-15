import { defineConfig } from 'vite-plus'

export default defineConfig({
  fmt: {
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 80,
  },
  pack: {
    entry: ['src/index.ts'],
    dts: true,
    format: ['esm'],
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
