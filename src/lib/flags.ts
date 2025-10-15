export function getFeatureFlag(name: string, fallback: boolean = false): boolean {
  const val = process.env[name];
  if (val === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[FOLIO] Missing env flag: ${name}. Falling back to ${fallback}`);
    }
    return fallback;
  }
  return val === "1" || val.toLowerCase() === "true";
}




