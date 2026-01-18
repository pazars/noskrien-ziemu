import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/deprecated/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
});
