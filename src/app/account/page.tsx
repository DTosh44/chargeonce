import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookmarkCheck,
  CarFront,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { Card, PageHeader, buttonStyles } from "@/components/ui";

export const metadata: Metadata = {
  title: "Account",
  description: "Learn about future ChargeOnce account features.",
};

export default function AccountPage() {
  return (
    <div className="shell page-section">
      <PageHeader
        eyebrow="Your account"
        title="Your journeys, all in one place."
        description="ChargeOnce works without an account today. A secure account experience is planned for a future release."
      />
      <div className="account-grid">
        <Card className="account-panel">
          <span className="eyebrow">Coming later</span>
          <h2 style={{ marginTop: 17 }}>A smarter home for your EV life.</h2>
          <p>
            We’re not collecting sign-in details in this preview. You can still
            choose a car, compare demo chargers and run estimates now.
          </p>
          <div className="coming-soon">
            <LockKeyhole size={19} aria-hidden="true" />
            <span>
              Sign-in and saved accounts are not enabled yet. No password or
              personal information is requested on this page.
            </span>
          </div>
          <Link
            href="/map"
            className={buttonStyles()}
            style={{ marginTop: 22 }}
          >
            Explore without signing in{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Card>
        <Card className="account-info">
          <h3>What an account will unlock</h3>
          <ul>
            <li>
              <CarFront size={20} aria-hidden="true" />
              <span>
                Save multiple vehicles and switch between them quickly.
              </span>
            </li>
            <li>
              <BookmarkCheck size={20} aria-hidden="true" />
              <span>Keep favourite chargers and recent journey plans.</span>
            </li>
            <li>
              <Sparkles size={20} aria-hidden="true" />
              <span>Get personalised recommendations wherever you go.</span>
            </li>
          </ul>
          <p className="section-copy" style={{ fontSize: 12 }}>
            The current demo remembers your selected vehicle only in this
            browser’s local storage.
          </p>
        </Card>
      </div>
    </div>
  );
}
