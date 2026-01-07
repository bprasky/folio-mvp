/**
 * Determines if the given email belongs to the designer demo account.
 * 
 * This function is used to gate Designer Demo Mode functionality.
 * Only the email demodesigner@folio.com should enable the demo flow.
 * 
 * @param userEmail - The user's email address (may be null or undefined)
 * @returns true if the email matches the designer demo account, false otherwise
 */
export const isDesignerDemoUser = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return userEmail.toLowerCase().trim() === 'demodesigner@folio.com';
};




