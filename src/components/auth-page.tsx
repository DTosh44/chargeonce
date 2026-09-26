import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth.server";
import { safeReturnPath } from "@/domain/auth";
import { AuthForm } from "@/components/auth-forms";
import { Card, PageHeader } from "@/components/ui";
export async function AuthPage({
  signup,
  searchParams,
}: {
  signup: boolean;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [auth, query] = await Promise.all([getAuthState(), searchParams]);
  const next = safeReturnPath(query.next);
  if (auth.status === "authenticated") redirect(next);
  const enabled = auth.status !== "unconfigured";
  return (
    <div className="shell page-section">
      <PageHeader
        eyebrow="Your ChargeOnce account"
        title={signup ? "A home for all your cars." : "Welcome back."}
        description={
          signup
            ? "Save your EVs and keep your current car in sync across devices."
            : "Sign in to your garage and pick up where you left off."
        }
      />
      <Card className="auth-panel">
        {!enabled && (
          <p className="notice" role="status">
            Accounts aren’t configured in this environment yet. Sign-in is
            disabled; the demo charging tools still work without an account.
          </p>
        )}
        {(auth.status === "unavailable" || query.error === "unavailable") && (
          <p className="form-feedback error" role="alert">
            The account service is temporarily unavailable. Please try again
            shortly.
          </p>
        )}
        {query.error === "expired" && (
          <p className="form-feedback error" role="alert">
            That email link is invalid, expired or already used. Request a fresh
            link and open the newest email. If using the default email template,
            use the browser that requested it.
          </p>
        )}
        <AuthForm signup={signup} enabled={enabled} next={next} />
        <Link href="/map">Continue with demo chargers without signing in</Link>
      </Card>
    </div>
  );
}
