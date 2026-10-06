import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, encodeSession, exchangeCodeForEmail } from "@/lib/auth";

// Google redirects here with ?code&state. Verify the state, exchange the code, and set the signed
// session cookie with the verified email. On any failure, bounce to the sign-in page.
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expectedState = store.get("fb_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/signin?error=state", origin));
  }

  const email = await exchangeCodeForEmail(code, origin);
  if (!email) {
    return NextResponse.redirect(new URL("/signin?error=exchange", origin));
  }

  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set(SESSION_COOKIE, encodeSession(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  res.cookies.delete("fb_oauth_state");
  return res;
}
