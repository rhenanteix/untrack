"use client";

import Link from "next/link";
import { analytics } from "@/lib/client/analytics";

export function ToolCrossSell({
  product,
  title,
  description,
  label,
  href,
}: {
  product: string;
  title: string;
  description: string;
  label: string;
  href: string;
}) {
  return (
    <aside className="tool-cross-sell">
      <div>
        <span className="eyebrow">Próximo passo</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <Link
        className="button button-secondary"
        href={href}
        onClick={() =>
          analytics.track("product_cross_sell_clicked", {
            product,
            source: "tool-result",
            location: "cross-sell",
          })
        }
      >
        {label}
      </Link>
    </aside>
  );
}