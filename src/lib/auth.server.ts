import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import type { AuthState } from "@/domain/auth";

export const getAuthState = cache(async (): Promise<AuthState> => {
  const client = await createSessionClient();
  if (!client) return { status: "unconfigured", user: null };
  try {
    const { data, error } = await client.auth.getUser();
    if (data.user && !error)
      return {
        status: "authenticated",
        user: { id: data.user.id, email: data.user.email ?? null },
      };
    if (
      !error ||
      error.name === "AuthSessionMissingError" ||
      error.status === 401 ||
      error.status === 403
    )
      return { status: "anonymous", user: null };
  } catch {
    /* A provider outage must not break public charging tools. */
  }
  return { status: "unavailable", user: null };
});

export async function requireAccount(next: string) {
  const auth = await getAuthState();
  if (auth.status !== "authenticated")
    redirect(
      `/sign-in?next=${encodeURIComponent(next)}${auth.status === "unavailable" ? "&error=unavailable" : ""}`,
    );
  return auth.user;
}

/** Configured server origin, not an attacker-controlled forwarded Host header. */
export function authSiteOrigin(): string | null {
  const configured = process.env.CHARGEONCE_SITE_URL;
  const fallback =
    process.env.NODE_ENV === "development" ? "http://localhost:3000" : null;
  try {
    const url = new URL(configured || fallback || "");
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      return null;
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
