import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

function clear(req: Request): Response {
  const origin = new URL(req.url).origin;
  const res = NextResponse.redirect(new URL("/signin", origin));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function POST(req: Request): Promise<Response> {
  return clear(req);
}

export async function GET(req: Request): Promise<Response> {
  return clear(req);
}
