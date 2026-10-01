import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionFromHeaders } from "@/lib/session";

export const metadata = {
  title: { default: "Visão geral", template: "%s · Untrack" },
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await sessionFromHeaders(await headers())))
    redirect("/entrar?next=/untrack/smart-pages");
  return children;
}
