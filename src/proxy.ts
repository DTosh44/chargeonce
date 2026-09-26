import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseConfiguration } from "@/config/supabase";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  const config = readSupabaseConfiguration(process.env);
  let response = NextResponse.next({ request });
  // Every page may contain private account/garage state. Never share cached sessions.
  response.headers.set("Cache-Control", "private, no-store");
  if (config.status !== "configured") return response;
  const client = createServerClient<Database>(
    config.url,
    config.publishableKey,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      db: { timeout: 8000, retry: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)])
              : AbortSignal.timeout(8000),
            cache: "no-store",
          }),
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          const previousCookies = response.cookies.getAll();
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          previousCookies.forEach((cookie) => response.cookies.set(cookie));
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
          response.headers.set("Cache-Control", "private, no-store");
        },
      },
    },
  );
  try {
    await client.auth.getUser();
  } catch {
    /* Pages and actions handle outages. */
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
