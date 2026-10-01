import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionFromHeaders } from "@/lib/session";
import { WorkspaceShell } from "@/components/untrack/shell";
export const metadata = {
  title: "Untrack",
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await sessionFromHeaders(await headers())))
    redirect("/entrar?next=/untrack/smart-pages");
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
