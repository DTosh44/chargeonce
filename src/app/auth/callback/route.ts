import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/domain/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const client = await createSessionClient();
  let path = "/sign-in?error=expired";
  try {
    if (code && client) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error)
        path = safeReturnPath(request.nextUrl.searchParams.get("next"));
    }
  } catch {
    path = "/sign-in?error=unavailable";
  }
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
