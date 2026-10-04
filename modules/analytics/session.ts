const defaultSessionTimeoutMinutes = 30;

export function analyticsSessionTimeoutMinutes() {
  const configured = Number(process.env.ANALYTICS_SESSION_TIMEOUT_MINUTES);
  return Number.isInteger(configured) && configured >= 5 && configured <= 240
    ? configured
    : defaultSessionTimeoutMinutes;
}

export function analyticsSessionTimeoutMilliseconds() {
  return analyticsSessionTimeoutMinutes() * 60_000;
}