import type { Metadata } from "next";
import Link from "next/link";
import { requireAccount } from "@/lib/auth.server";
import { createSessionClient } from "@/lib/supabase/server";
import { createUserDataRepository } from "@/providers/supabase/user-data";
import { SignOutForm } from "@/components/auth-forms";
import { ProfileForm } from "@/components/profile-form";
import { Card, PageHeader, buttonStyles } from "@/components/ui";
import type { Profile } from "@/domain/models";
export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};
export default async function AccountPage() {
  const user = await requireAccount("/account");
  let profile: Profile | null = null;
  try {
    profile = await createUserDataRepository(
      await createSessionClient(),
    ).getProfile();
  } catch {
    /* Render a recoverable error, never fabricated profile data. */
  }
  return (
    <div className="shell page-section">
      <PageHeader
        eyebrow="Your account"
        title="Your EV life, in one place."
        description="Manage your profile and saved cars."
      />
      <div className="account-grid">
        <Card className="garage-panel">
          <h2>Account details</h2>
          <p>Signed in as {user.email ?? "your ChargeOnce account"}.</p>
          {profile ? (
            <ProfileForm profile={profile} />
          ) : (
            <p className="form-feedback error" role="alert">
              Your profile couldn’t be loaded. Please refresh to try again.
            </p>
          )}
        </Card>
        <Card className="garage-panel">
          <h2>Your garage</h2>
          <p>
            Save multiple EVs and keep one current car in sync across devices.
          </p>
          <Link className={buttonStyles()} href="/cars">
            Manage My Cars
          </Link>
          <hr />
          <SignOutForm />
        </Card>
      </div>
    </div>
  );
}
