import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['src/__tests__/globalSetup.ts', 'src/__tests__/globalTeardown.ts'],
    setupFiles: ['src/__tests__/helpers/loadEnv.ts', 'src/__tests__/setup.ts'],
    pool: 'forks',
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
