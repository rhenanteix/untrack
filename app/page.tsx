import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { LandingV2 } from "@/components/landing-v2-page";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  if (process.env.NEXT_PUBLIC_LANDING_V2 === "true") {
    return <LandingV2 />;
  }
  return <LandingPage />;
}
