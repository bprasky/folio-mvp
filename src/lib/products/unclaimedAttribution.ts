/** Designer-supplied vendor text is attribution, never an account or a claim. */
export function unclaimedProductAttribution(brand: string | null | undefined): {
  brand: string | null;
  vendorId: null;
} {
  return { brand: brand?.trim() || null, vendorId: null };
}
