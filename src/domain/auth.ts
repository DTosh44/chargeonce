export interface AccountIdentity {
  id: string;
  email: string | null;
}
export type AuthState =
  | { status: "authenticated"; user: AccountIdentity }
  | { status: "anonymous" | "unconfigured" | "unavailable"; user: null };
export interface FormResult {
  status: "idle" | "success" | "error";
  message: string;
}
export const initialFormResult: FormResult = { status: "idle", message: "" };
// A future OAuth adapter can enable these without changing account/garage models.
export type OAuthProvider = "google" | "apple";
export const oauthProviders: Record<OAuthProvider, { enabled: boolean }> = {
  google: { enabled: false },
  apple: { enabled: false },
};

/** Never allow a login form or email link to redirect outside this application. */
export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\x00-\x20]/.test(value)
  )
    return "/cars";
  try {
    const url = new URL(value, "https://chargeonce.invalid");
    if (
      url.origin !== "https://chargeonce.invalid" ||
      url.pathname.startsWith("/auth") ||
      ["/sign-in", "/sign-up"].includes(url.pathname)
    )
      return "/cars";
    return url.pathname + url.search;
  } catch {
    return "/cars";
  }
}

export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
