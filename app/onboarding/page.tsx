import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { sessionFromHeaders } from "@/lib/session";
import { safeReturnPath } from "@/modules/auth/return-path";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await sessionFromHeaders(await headers()))) redirect("/entrar?next=/onboarding");
  return <OnboardingFlow returnTo={safeReturnPath((await searchParams).next)} />;
}