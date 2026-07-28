import type { RoleDelta } from "./types";
import { DESIGNER } from "./designer";
import { ARCHITECT } from "./architect";
import { CONTRACTOR } from "./contractor";
import { VENDOR } from "./vendor";

export type { RoleDelta } from "./types";
export { DESIGNER, ARCHITECT, CONTRACTOR, VENDOR };

/** Canonical role deltas, keyed by canonical role term (docs/17 §7). */
export const ROLE_DELTAS: Record<string, RoleDelta> = {
  Designer: DESIGNER,
  Architect: ARCHITECT,
  Contractor: CONTRACTOR,
  Vendor: VENDOR,
};
