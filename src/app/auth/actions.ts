"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase/server";
import { authSiteOrigin } from "@/lib/auth.server";
import { safeReturnPath, validEmail, type FormResult } from "@/domain/auth";

export async function authenticate(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const client = await createSessionClient();
  const fail = (message: string): FormResult => ({ status: "error", message });
  if (!client)
    return fail(
      "Accounts are not configured yet. You can still use the demo charging tools.",
    );
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const mode = String(form.get("mode") ?? "password");
  const next = safeReturnPath(form.get("next"));
  if (!validEmail(email)) return fail("Enter a valid email address.");
  if (!["password", "signup", "magic"].includes(mode))
    return fail("Choose a supported sign-in method.");
  if (mode !== "magic" && (!password || password.length > 128))
    return fail("Enter a password of no more than 128 characters.");
  if (mode === "signup" && password.length < 10)
    return fail("Use at least 10 characters for your password.");
  let signedIn = false;
  try {
    if (mode === "password") {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error)
        return fail(
          "We couldn’t sign you in. Check your details and confirm your email, or try a magic link.",
        );
      signedIn = true;
    } else {
      const origin = authSiteOrigin();
      if (!origin)
        return fail(
          "Email sign-in is not configured yet. Please contact the site owner.",
        );
      const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
      if (mode === "signup") {
        const displayName = String(form.get("displayName") ?? "").trim();
        if (!displayName || displayName.length > 120)
          return fail("Enter a display name of 1–120 characters.");
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo, data: { display_name: displayName } },
        });
        if (error)
          return fail(
            "We couldn’t create your account. Please try again later or sign in if you already have an account.",
          );
        signedIn = !!data.session;
      } else {
        // Magic links sign in existing accounts, not silently create new ones.
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo, shouldCreateUser: false },
        });
        if (error?.status === 429)
          return fail(
            "Too many email requests. Wait a little before trying again.",
          );
        if (error && error.status && error.status >= 500)
          return fail(
            "Email sign-in is temporarily unavailable. Please try again.",
          );
        // Do not reveal whether an address exists.
      }
      if (!signedIn)
        return {
          status: "success",
          message:
            mode === "signup"
              ? "Check your inbox to confirm your account. If you already have an account, sign in instead."
              : "If you have a confirmed account, a sign-in link is on its way. Open the newest email link; it can only be used once.",
        };
    }
  } catch {
    return fail(
      "Sign-in is temporarily unavailable. Your details have not been saved locally. Please try again.",
    );
  }
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut(): Promise<FormResult> {
  const client = await createSessionClient();
  try {
    if (client) {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error)
        return {
          status: "error",
          message: "We couldn’t sign you out. Please try again.",
        };
    }
  } catch {
    return {
      status: "error",
      message: "Sign-out is temporarily unavailable. Please try again.",
    };
  }
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
