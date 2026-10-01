"use client";

import { useEffect } from "react";

const visitorKey = "arrume-meu-link:smart-page-session";

function sessionVisitorId() {
  try {
    const saved = window.sessionStorage.getItem(visitorKey);
    if (saved) return saved;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(visitorKey, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function track(
  event: "smart_page_view" | "smart_block_view" | "smart_block_clicked",
  slug: string,
  blockId?: string,
) {
  return fetch("/api/smart-pages/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      slug,
      visitorId: sessionVisitorId(),
      blockId,
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export function SmartPageTracker({
  slug,
  blockIds,
}: {
  slug: string;
  blockIds: string[];
}) {
  useEffect(() => {
    void track("smart_page_view", slug);
    for (const blockId of blockIds)
      void track("smart_block_view", slug, blockId);
  }, [blockIds, slug]);

  return null;
}

export function SmartPageLink({
  slug,
  blockId,
  href,
  openInNewTab,
  children,
}: {
  slug: string;
  blockId: string;
  href: string;
  openInNewTab: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      className="smart-page-link"
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noreferrer" : undefined}
      onClick={() => {
        void track("smart_block_clicked", slug, blockId);
      }}
    >
      {children}
    </a>
  );
}
