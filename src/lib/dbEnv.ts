export function logDbEnv(where: string) {
  const url = process.env.DATABASE_URL ?? '(missing)';
  // show host/db only (safe for console)
  let safe = url;
  try {
    const u = new URL(url);
    safe = `${u.protocol}//${u.hostname}:${u.port}/${u.pathname.replace(/^\//,'')}`;
  } catch { /* ignore */ }
  console.log(`[db-env] (${where}) DATABASE_URL = ${safe}`);
}







