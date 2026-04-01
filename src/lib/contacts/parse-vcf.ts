/**
 * Parse VCF/vCard files into structured contact records.
 *
 * Supports vCard 2.1, 3.0, and 4.0 basic fields:
 *   FN (Full Name), EMAIL, ORG (Organization), TITLE
 */

import type { ParsedContact } from './parse-csv';

export function parseVcf(vcfContent: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  const cards = vcfContent.split(/(?=BEGIN:VCARD)/i);

  for (const card of cards) {
    if (!card.trim()) continue;

    const lines = unfoldLines(card);
    let name = '';
    let email = '';
    let company = '';
    let title = '';

    for (const line of lines) {
      const upperLine = line.toUpperCase();

      if (upperLine.startsWith('FN')) {
        name = extractValue(line);
      } else if (upperLine.startsWith('N:') || upperLine.startsWith('N;')) {
        // N:LastName;FirstName;MiddleName;Prefix;Suffix
        if (!name) {
          const parts = extractValue(line).split(';');
          const last = parts[0] || '';
          const first = parts[1] || '';
          name = [first, last].filter(Boolean).join(' ').trim();
        }
      } else if (upperLine.startsWith('EMAIL')) {
        // Take the first email found
        if (!email) {
          email = extractValue(line).toLowerCase();
        }
      } else if (upperLine.startsWith('ORG')) {
        company = extractValue(line).split(';')[0].trim();
      } else if (upperLine.startsWith('TITLE')) {
        title = extractValue(line);
      }
    }

    if (email) {
      contacts.push({
        name: name || email.split('@')[0],
        email,
        company: company || undefined,
        title: title || undefined,
      });
    }
  }

  return contacts;
}

/**
 * Unfold vCard continuation lines (lines starting with space/tab).
 */
function unfoldLines(card: string): string[] {
  return card
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/)
    .filter(line => line.trim());
}

/**
 * Extract the value from a vCard property line.
 * Handles: "PROP;PARAMS:VALUE" and "PROP:VALUE"
 */
function extractValue(line: string): string {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return '';
  return line.slice(colonIdx + 1).trim();
}
