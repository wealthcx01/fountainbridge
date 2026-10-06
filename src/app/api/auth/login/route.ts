import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { devLoginEnabled, googleAuthUrl, googleConfigured } from "@/lib/auth";

// Start Google OAuth. When Google isn't configured, fall back to the sign-in page (which offers
// the guarded dev-login in dev/test, or explains the missing config in prod).
export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  if (!googleConfigured()) {
    const to = devLoginEnabled() ? "/signin?dev=1" : "/signin?oauth=unconfigured";
    return NextResponse.redirect(new URL(to, origin));
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(googleAuthUrl(origin, state));
  res.cookies.set("fb_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 600,
  });
  return res;
}
