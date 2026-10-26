/** Bounded JSON workflow transport. A timeout is an uncertain result, never an automatic retry. */
export async function workflowRequest(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 90_000): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('The request timed out. Its result is not confirmed. Check your saved work before retrying.'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetch(input, { ...init, signal: controller.signal });
      // Include a stalled response body in the deadline, not just response headers.
      const body = await response.text();
      if (response.status === 401) throw new Error('Your session expired. Sign in again, then retry. Your saved work is retained.');
      return new Response(body || null, { status: response.status, statusText: response.statusText, headers: response.headers });
    })()]);
  } finally { clearTimeout(timer); }
}
