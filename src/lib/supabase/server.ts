import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSupabaseConfiguration } from "@/config/supabase";
import type { Database } from "./database.types";

function configuration() {
  return readSupabaseConfiguration(process.env);
}

/** Public RLS-scoped catalogue client. No service-role key, session or admin bypass. */
export function createCatalogueClient() {
  const config = configuration();
  if (config.status !== "configured") return null;
  return createClient<Database>(config.url, config.publishableKey, {
    db: { timeout: 8000, retry: false },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

/** Request-scoped server actions/routes client. User JWT + RLS, never admin. */
export async function createSessionClient() {
  const config = configuration();
  if (config.status !== "configured") return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.publishableKey, {
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
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server Components are read-only; auth actions must use a writable context. */
        }
      },
    },
  });
}
