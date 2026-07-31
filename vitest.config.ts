import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for the server-side lib (authz, ventures, github) and for the pure logic inside the
// venture-box deploy scripts (FB-050's brain partitioning/digest, which decides what a lane plans
// from). Node environment — no DOM needed. Component/e2e coverage is Playwright (e2e/,
// `npm run test:e2e`), kept out of the unit run.
export default defineConfig({
  // `server-only` throws on import outside a server bundle — that is the whole point of it, and it is
  // what makes the "this secret never reaches the client" boundary a build error rather than a
  // comment. Under vitest there is no server/client split, so resolve it to the package's own empty
  // (react-server) entry instead of its throwing default.
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'deploy/**/*.test.mjs', 'scripts/**/*.test.mjs'],
  },
});
