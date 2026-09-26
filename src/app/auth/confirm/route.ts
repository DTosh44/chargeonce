import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/domain/auth";

/** Token-hash email templates work across browsers/devices (unlike PKCE callbacks). */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const client = await createSessionClient();
  let path = "/sign-in?error=expired";
  try {
    if (
      token &&
      client &&
      (type === "email" || type === "signup" || type === "magiclink")
    ) {
      const { error } = await client.auth.verifyOtp({
        token_hash: token,
        type,
      });
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
