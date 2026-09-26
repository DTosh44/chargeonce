"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { authenticate, signOut } from "@/app/auth/actions";
import { initialFormResult, type FormResult } from "@/domain/auth";
import { Button, Input } from "@/components/ui";

export function FormFeedback({ result }: { result: FormResult }) {
  return result.message ? (
    <p
      className={`form-feedback ${result.status}`}
      role={result.status === "error" ? "alert" : "status"}
    >
      {result.message}
    </p>
  ) : null;
}
export function AuthForm({
  signup = false,
  enabled,
  next,
}: {
  signup?: boolean;
  enabled: boolean;
  next: string;
}) {
  const [method, setMethod] = useState<"password" | "magic">("password");
  const [result, action, pending] = useActionState(
    authenticate,
    initialFormResult,
  );
  return (
    <>
      {!signup && (
        <div className="tabs" role="group" aria-label="Sign-in method">
          <button
            type="button"
            className={`tab ${method === "password" ? "active" : ""}`}
            aria-pressed={method === "password"}
            disabled={pending}
            onClick={() => setMethod("password")}
          >
            Password
          </button>
          <button
            type="button"
            className={`tab ${method === "magic" ? "active" : ""}`}
            aria-pressed={method === "magic"}
            disabled={pending}
            onClick={() => setMethod("magic")}
          >
            Magic link
          </button>
        </div>
      )}
      <form action={action} className="stack-form">
        <input type="hidden" name="mode" value={signup ? "signup" : method} />
        <input type="hidden" name="next" value={next} />
        <fieldset disabled={!enabled || pending} className="form-fields">
          {signup && (
            <label className="field-label" htmlFor="display-name">
              Display name
              <Input
                id="display-name"
                name="displayName"
                autoComplete="nickname"
                required
                maxLength={120}
              />
            </label>
          )}
          <label className="field-label" htmlFor="email">
            Email
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          {(signup || method === "password") && (
            <label className="field-label" htmlFor="password">
              Password
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 10 : 1}
                maxLength={128}
                required
              />
              {signup && (
                <small>At least 10 characters. Use a unique password.</small>
              )}
            </label>
          )}
          {!signup && method === "magic" && (
            <p>
              We’ll email a one-time sign-in link to your confirmed account. No
              password needed.
            </p>
          )}
          <Button type="submit">
            {pending
              ? "Please wait…"
              : signup
                ? "Create account"
                : method === "magic"
                  ? "Email me a sign-in link"
                  : "Sign in"}
          </Button>
        </fieldset>
        <FormFeedback result={result} />
      </form>
      <p>
        {signup ? "Already have an account? " : "New to ChargeOnce? "}
        <Link
          href={`${signup ? "/sign-in" : "/sign-up"}?next=${encodeURIComponent(next)}`}
        >
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </>
  );
}
export function SignOutForm() {
  const [result, action, pending] = useActionState(signOut, initialFormResult);
  return (
    <form action={action}>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Signing out…" : "Sign out of this browser"}
      </Button>
      <FormFeedback result={result} />
    </form>
  );
}
