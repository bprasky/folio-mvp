import type { RoleDelta } from "./types";

export const DESIGNER: RoleDelta = {
  role: "Designer",
  relationship: "They designed it for a client; they do not live there.",
  focus:
    "design decisions, client relationship, material selections, aesthetic vision, and professional philosophy",
  avoid:
    "do not ask about construction phasing unless it shaped a design decision; do not ask about their family or home as if they live there",
};
