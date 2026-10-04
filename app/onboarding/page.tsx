import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { sessionFromHeaders } from "@/lib/session";
import { safeReturnPath } from "@/modules/auth/return-path";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string; trial?: string }> }) {
  if (!(await sessionFromHeaders(await headers()))) redirect("/entrar?next=/onboarding");
  const query = await searchParams;
  return <OnboardingFlow returnTo={safeReturnPath(query.next)} trialStarted={query.trial === "started"} />;
}