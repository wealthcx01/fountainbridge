import { defineConfig } from 'vitest/config';

// Unit tests for the server-side lib (authz, ventures, github). Node environment — no DOM needed.
// Component/e2e coverage is Playwright (e2e/, `npm run test:e2e`), kept out of the unit run.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
