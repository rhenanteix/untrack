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

type SmartPageEvent =
  | "smart_page_view"
  | "smart_block_view"
  | "smart_block_clicked"
  | "link_in_bio_product_view"
  | "link_in_bio_product_click";

function track(
  event: SmartPageEvent,
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
  blocks,
}: {
  slug: string;
  blocks: { id: string; type: "link" | "product" }[];
}) {
  useEffect(() => {
    void track("smart_page_view", slug);
    for (const block of blocks)
      void track(
        block.type === "product"
          ? "link_in_bio_product_view"
          : "smart_block_view",
        slug,
        block.id,
      );
  }, [blocks, slug]);

  return null;
}

export function SmartPageLink({
  slug,
  blockId,
  href,
  openInNewTab,
  event = "smart_block_clicked",
  children,
}: {
  slug: string;
  blockId: string;
  href: string;
  openInNewTab: boolean;
  event?: "smart_block_clicked" | "link_in_bio_product_click";
  children: React.ReactNode;
}) {
  return (
    <a
      className="smart-page-link"
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noreferrer" : undefined}
      onClick={() => {
        void track(event, slug, blockId);
      }}
    >
      {children}
    </a>
  );
}

export function SmartPageProductTracker({
  slug,
  blockId,
}: {
  slug: string;
  blockId: string;
}) {
  useEffect(() => {
    void track("link_in_bio_product_view", slug, blockId);
  }, [blockId, slug]);
  return null;
}
