// How Railway builds, starts and watches the studio (FB-229).
//
// This replaces railway.json, which Railway stops reading on 2026-12-01. It carries the same five
// settings, unchanged. `railway config migrate` wrote the first draft of this file and dropped two of
// them: it left the builder as a comment and lost the restart policy entirely. They are written in by
// hand below. lib/railway-config.test.ts fails if any of the five goes missing or changes.
//
// Railway does NOT read this file when it deploys. It only takes effect when someone runs
// `railway config apply` against an environment. Until that has been done for staging and production,
// railway.json is still what Railway uses, and it must not be deleted. docs/deploy.md has the steps.
import { defineRailway, github, preserve, project, service } from 'railway/iac';

// The studio is the only service in this file. `partial` tells Railway to manage only what is
// declared here and leave anything else in the project alone.
export const partial = 'foundry-studio';

export default defineRailway(() => {
  const studio = service('foundry-studio', {
    // Where the code comes from. Leave this out and `railway config apply` disconnects the
    // service from GitHub.
    source: github('wealthcx01/fountainbridge', { branch: 'main' }),
    // The studio's settings and keys. Every one is `preserve()`: this file names them so that
    // `apply` keeps them, and never holds a value. A name missing from this list is DELETED from the
    // environment by `apply`, which would sign everyone out or stop the studio starting. So always
    // run `railway config plan` first and stop if it says anything will be destroyed.
    env: {
      AUTH_SECRET: preserve(),
      AUTH_TRUST_HOST: preserve(),
      AUTH_URL: preserve(),
      GITHUB_ORG: preserve(),
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      NIXPACKS_NODE_VERSION: preserve(),
      STUDIO_ADMIN_EMAILS: preserve(),
    },
    build: {
      builder: 'NIXPACKS',
    },
    deploy: {
      startCommand: 'npm run start',
      // Without this, a deploy that starts but cannot serve a page is still marked healthy.
      healthcheckPath: '/api/health',
      healthcheckTimeout: 100,
      // If the studio crashes, Railway restarts it, up to three times.
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 3,
    },
  });
  return project('foundry-studio', {
    resources: [studio],
  });
});
