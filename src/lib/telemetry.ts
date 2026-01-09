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

/**
 * Time a function execution and log it
 * @param label - Label for the timing
 * @param fn - Async function to time
 */
export async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    console.debug(`[telemetry] ${label}: ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.debug(`[telemetry] ${label} (failed): ${duration.toFixed(2)}ms`);
    throw error;
  }
}
