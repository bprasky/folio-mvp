export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v === 'undefined' || v.trim() === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  return v.trim();
}


