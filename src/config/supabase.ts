export type SupabaseConfiguration =
  | { status: "configured"; url: string; publishableKey: string }
  | { status: "unconfigured" | "invalid" };

/** Only public keys are accepted, even though catalogue requests run server-side. */
export function readSupabaseConfiguration(env: {
  [key: string]: string | undefined;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}): SupabaseConfiguration {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !publishableKey) return { status: "unconfigured" };
  try {
    const parsed = new URL(url);
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(
      parsed.hostname,
    );
    if (
      parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && isLocal)
    )
      return { status: "invalid" };
    if (
      publishableKey.startsWith("sb_publishable_") &&
      publishableKey.length > 20
    )
      return { status: "configured", url, publishableKey };
    // Legacy anon JWTs are supported; service_role JWTs and sb_secret_ keys are rejected.
    const parts = publishableKey.split(".");
    if (parts.length !== 3) return { status: "invalid" };
    const payload: unknown = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (
      payload &&
      typeof payload === "object" &&
      "role" in payload &&
      payload.role === "anon"
    )
      return { status: "configured", url, publishableKey };
  } catch {
    /* Invalid configuration must not break the no-credentials demo. */
  }
  return { status: "invalid" };
}
