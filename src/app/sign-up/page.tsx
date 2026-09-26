import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";
export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};
export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return <AuthPage signup searchParams={searchParams} />;
}
