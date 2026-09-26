import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return <AuthPage signup={false} searchParams={searchParams} />;
}
