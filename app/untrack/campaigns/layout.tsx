import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionFromHeaders } from "@/lib/session";

export default async function CampaignLayout({ children }: { children: React.ReactNode }) {
  if (!await sessionFromHeaders(await headers())) redirect("/entrar?next=/untrack/campaigns");
  return <>{children}</>;
}
