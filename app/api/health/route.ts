// Health endpoint (FB-009): Railway's healthcheck + the external uptime monitor ping this. Public
// (excluded from the auth middleware) and always dynamic so it reflects live process health.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok', service: 'foundry-studio' }, { status: 200 });
}
