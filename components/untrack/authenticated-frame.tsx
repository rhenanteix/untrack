"use client";
import { usePathname } from "next/navigation";
import { WorkspaceShell } from "./shell";
export function AuthenticatedFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return pathname.startsWith("/untrack/smart-pages") ? (
    children
  ) : pathname === "/conta" ||
    pathname.startsWith("/conta/") ||
    pathname === "/untrack" ||
    pathname.startsWith("/untrack/") ? (
    <WorkspaceShell>{children}</WorkspaceShell>
  ) : (
    children
  );
}
