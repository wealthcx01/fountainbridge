// Which build is answering (FB-272), the same as the website's `/build-id`.
//
// The factory's runtime host sets FACTORY_RUNTIME_CANDIDATE on the copy it starts, and checks that
// this path answers with exactly that string. Otherwise it is the commit: Railway sets
// RAILWAY_GIT_COMMIT_SHA, and the test copy (`scripts/test-copy.mjs`) sets BUILD_COMMIT_SHA.
//
// Public, like `/api/health`, because the factory asks before anyone has signed in. It names a
// commit of a public repository and nothing else.
//
// Read on each request, so a restart with a new value shows it without a rebuild.
export const dynamic = 'force-dynamic';

export function GET() {
  const id =
    process.env.FACTORY_RUNTIME_CANDIDATE ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.BUILD_COMMIT_SHA ||
    'unknown';
  return new Response(id, { headers: { 'Content-Type': 'text/plain' } });
}
