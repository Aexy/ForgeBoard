import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      { find: 'next-auth/providers/credentials', replacement: fileURLToPath(new URL('./test/credentials.ts', import.meta.url)) },
      { find: 'next-auth', replacement: fileURLToPath(new URL('./test/next-auth.ts', import.meta.url)) },
      { find: 'server-only', replacement: fileURLToPath(new URL('./test/server-only.ts', import.meta.url)) },
      { find: '@', replacement: fileURLToPath(new URL('./', import.meta.url)) },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
