import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="shell page-section" style={{ textAlign: "center" }}>
      <span className="eyebrow">Page not found</span>
      <h1 style={{ fontSize: 56, letterSpacing: "-.06em", margin: "15px 0" }}>
        Wrong turn?
      </h1>
      <p className="section-copy" style={{ margin: "0 auto 25px" }}>
        This page doesn’t exist. Let’s get you back on the road.
      </p>
      <Link href="/" className={buttonStyles()}>
        <ArrowLeft size={17} aria-hidden="true" /> Back to home
      </Link>
    </div>
  );
}
