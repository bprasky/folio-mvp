export type NavEvent =
  | { type: 'nav_open'; mode: string }
  | { type: 'nav_close'; mode: string }
  | { type: 'nav_pin'; pinned: boolean }
  | { type: 'nav_click'; href: string };

export function trackNav(evt: NavEvent) {
  try {
    // Wire to your analytics provider here
    // window.analytics?.track('nav_event', evt);
    console.debug('[telemetry]', evt);
  } catch {
    // no-op
  }
}
