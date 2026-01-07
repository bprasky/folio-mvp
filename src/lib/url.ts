export function appBaseUrl(req?: Request) {
  // Prefer public URL if provided, else server APP_URL, else request origin, else localhost
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "";

  if (envUrl) return envUrl.replace(/\/$/, "");

  if (req) {
    const origin = req.headers.get("origin") || "";
    if (origin) return origin.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}




