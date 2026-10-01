"use client";

import type { ComponentProps, ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { analytics, type AnalyticsEventName } from "@/lib/client/analytics";

export function CommercialPageTracker({
  event,
}: {
  event: AnalyticsEventName;
}) {
  useEffect(() => {
    analytics.track(event);
  }, [event]);
  return null;
}

export function CommercialLink({
  children,
  events,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "onClick" | "children"> & {
  children: ReactNode;
  events: readonly AnalyticsEventName[];
  onClick?: ComponentProps<typeof Link>["onClick"];
}) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented)
          events.forEach((name) => analytics.track(name));
      }}
    >
      {children}
    </Link>
  );
}
