// Demo-safe visibility (no participants, no vendorOrgId):
// A project is visible if the current user owns it OR has at least one selection on it.
export function vendorProjectsWhereDemo(userId: string) {
  return {
    OR: [
      { ownerId: userId },
      { selections: { some: { vendorRepId: userId } } },
    ],
  };
}
