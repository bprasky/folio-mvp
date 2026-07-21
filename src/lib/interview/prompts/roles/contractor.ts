import type { RoleDelta } from "./types";

// Canonical term is Contractor (docs/17 §7). Supersedes the legacy "BUILDER" label; the
// persisted Role/ParticipantSide enum rename is a separate data migration
// (docs/audits/PHASE1_TERMINOLOGY.md).
export const CONTRACTOR: RoleDelta = {
  role: "Contractor",
  relationship: "They built it and solved the construction problems.",
  focus:
    "timeline, phasing, technical challenges, coordination between trades, and craftsmanship details most people would never notice",
  avoid: "do not ask about design philosophy or aesthetic vision as if they authored the design",
};
