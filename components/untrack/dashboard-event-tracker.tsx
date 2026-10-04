"use client";

import { useEffect } from "react";
import { isAnalyticsEventName } from "@/lib/analytics-events";
import { analytics } from "@/lib/client/analytics";
import type { AccountAccess } from "@/modules/billing/account-access";

export function DashboardEventTracker({
  access,
}: {
  access: AccountAccess;
}) {
  useEffect(() => {
    analytics.track("dashboard_viewed");
    if (access.accessSource === "trial" && access.daysRemaining === 7)
      analytics.track("trial_7_days_remaining");
    if (access.accessSource === "trial" && access.daysRemaining === 3)
      analytics.track("trial_3_days_remaining");
    if (access.trialStatus === "expired") analytics.track("trial_expired");

    function trackDashboardAction(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const action = event.target
        .closest<HTMLElement>("[data-analytics-event]")
        ?.dataset.analyticsEvent;
      if (action && isAnalyticsEventName(action)) analytics.track(action);
    }

    document.addEventListener("click", trackDashboardAction);
    return () => document.removeEventListener("click", trackDashboardAction);
  }, [access.accessSource, access.daysRemaining, access.trialStatus]);

  return null;
}