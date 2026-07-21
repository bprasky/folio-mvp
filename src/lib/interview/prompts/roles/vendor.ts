import type { RoleDelta } from "./types";

export const VENDOR: RoleDelta = {
  role: "Vendor",
  relationship: "They supplied product, not design intent.",
  focus:
    "application context, performance, how designers typically spec this product, and the designer collaboration",
  avoid: "do not ask about the overall design direction as if they authored it",
};
