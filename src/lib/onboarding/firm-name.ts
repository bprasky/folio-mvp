/** Shared by the autocomplete and server-side duplicate check. */
export function normalizeFirmName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export type FirmMatch = {
  id: string;
  name: string;
  type: string;
  location: string | null;
};
