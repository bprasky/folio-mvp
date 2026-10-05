export const COMPLETION_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type CompletionDate = { completedYear?: number | null; completedMonth?: number | null };

/** Sort newest first; unknown months follow known months within the same year. */
export function compareCompletionDates(a: CompletionDate, b: CompletionDate): number {
  return (b.completedYear ?? 0) - (a.completedYear ?? 0)
    || (b.completedMonth ?? 0) - (a.completedMonth ?? 0);
}

export function formatCompletionDate({ completedYear, completedMonth }: CompletionDate): string | null {
  if (completedYear == null) return null;
  const month = completedMonth == null ? null : COMPLETION_MONTHS[completedMonth - 1];
  return `Completed ${month ? `${month} ` : ''}${completedYear}`;
}

/** New completed-project intake requires a year, without assuming an unknown month. */
export function completionDateInputError(year: string, month: string, now = new Date()): string | null {
  const completedYear = Number(year);
  if (!year.trim()) return 'Add the year this project was completed.';
  if (!Number.isInteger(completedYear) || completedYear < 1800 || completedYear > now.getUTCFullYear()) {
    return `Enter a completion year between 1800 and ${now.getUTCFullYear()}.`;
  }
  if (month && (!Number.isInteger(Number(month)) || Number(month) < 1 || Number(month) > 12)) {
    return 'Choose a completion month, or leave it unknown.';
  }
  if (completedYear === now.getUTCFullYear() && Number(month) > now.getUTCMonth() + 1) {
    return 'The completion date cannot be in the future.';
  }
  return null;
}
