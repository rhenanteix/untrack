"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { analytics } from "@/lib/client/analytics";

/** Emits the `page_view` event once per route navigation. */
export function PageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      analytics.track("page_view");
      void analytics.trackPublicEvent("page_view", { path: pathname });
    }
  }, [pathname]);

  return null;
}
