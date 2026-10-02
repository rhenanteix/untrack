import { redirect } from "next/navigation";

export default function AnalyticsRedirectPage() {
  redirect("/untrack/analytics");
}