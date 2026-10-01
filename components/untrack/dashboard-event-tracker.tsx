"use client";

import { useEffect } from "react";
import { isAnalyticsEventName } from "@/lib/analytics-events";
import { analytics } from "@/lib/client/analytics";

export function DashboardEventTracker() {
  useEffect(() => {
    analytics.track("dashboard_viewed");

    function trackDashboardAction(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const action = event.target
        .closest<HTMLElement>("[data-analytics-event]")
        ?.dataset.analyticsEvent;
      if (action && isAnalyticsEventName(action)) analytics.track(action);
    }

    document.addEventListener("click", trackDashboardAction);
    return () => document.removeEventListener("click", trackDashboardAction);
  }, []);

  return null;
}