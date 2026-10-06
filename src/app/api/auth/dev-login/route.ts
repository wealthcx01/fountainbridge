import { NextResponse } from "next/server";
import { SESSION_COOKIE, devLoginEnabled, encodeSession } from "@/lib/auth";

// Guarded dev/test login: sets a session for a given email WITHOUT Google. Enabled only when
// STUDIO_DEV_LOGIN=1 and NODE_ENV != production — otherwise it 404s, so it can never be a prod
// backdoor. Used by Playwright to exercise the three scoping cases.
async function login(req: Request): Promise<Response> {
  if (!devLoginEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = new URL(req.url);
  let email = url.searchParams.get("email");
  if (!email && req.method === "POST") {
    try {
      const form = await req.formData();
      email = form.get("email")?.toString() ?? null;
    } catch {
      email = null;
    }
  }
  if (!email) {
    return new NextResponse("email required", { status: 400 });
  }
  const res = NextResponse.redirect(new URL("/", url.origin));
  res.cookies.set(SESSION_COOKIE, encodeSession(email), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export async function GET(req: Request): Promise<Response> {
  return login(req);
}

export async function POST(req: Request): Promise<Response> {
  return login(req);
}
