"use client";

import { useEffect } from "react";
import { analytics } from "@/lib/client/analytics";

type SmartPageEvent =
  | "smart_page_view"
  | "smart_block_view"
  | "form_view"
  | "smart_block_clicked"
  | "link_in_bio_product_view"
  | "link_in_bio_product_click"
  | "social_click";

function track(event: SmartPageEvent, slug: string, blockId?: string) {
  return analytics.trackSmartPage(event, slug, blockId);
}

export function SmartPageTracker({
  slug,
  blocks,
}: {
  slug: string;
  blocks: { id: string; type: string }[];
}) {
  useEffect(() => {
    void track("smart_page_view", slug);
    for (const block of blocks) {
      if (block.type === "form") continue;
      void track(
        block.type === "product"
          ? "link_in_bio_product_view"
          : "smart_block_view",
        slug,
        block.id,
      );
    }
  }, [blocks, slug]);

  return null;
}

export function SmartPageLink({
  slug,
  blockId,
  href,
  openInNewTab,
  event = "smart_block_clicked",
  className = "smart-page-link",
  children,
}: {
  slug: string;
  blockId: string;
  href: string;
  openInNewTab: boolean;
  event?: "smart_block_clicked" | "link_in_bio_product_click";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className={className}
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
