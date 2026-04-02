/**
 * Parse CSV contact files into structured contact records.
 *
 * Supports flexible header names:
 *   name/full name/first name+last name, email, company/organization, title/job title
 */

export interface ParsedContact {
  name: string;
  email: string;
  company?: string;
  title?: string;
}

const HEADER_MAP: Record<string, string> = {
  'name': 'name',
  'full name': 'name',
  'fullname': 'name',
  'display name': 'name',
  'first name': 'firstName',
  'firstname': 'firstName',
  'given name': 'firstName',
  'last name': 'lastName',
  'lastname': 'lastName',
  'family name': 'lastName',
  'surname': 'lastName',
  'email': 'email',
  'e-mail': 'email',
  'email address': 'email',
  'e-mail address': 'email',
  'work email': 'email',
  'company': 'company',
  'organization': 'company',
  'organisation': 'company',
  'company name': 'company',
  'org': 'company',
  'title': 'title',
  'job title': 'title',
  'jobtitle': 'title',
  'position': 'title',
  'role': 'title',
};

export function parseCsv(csvContent: string): ParsedContact[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseRow(lines[0]);
  const fieldMap = new Map<number, string>();

  for (let i = 0; i < headers.length; i++) {
    const normalized = headers[i].toLowerCase().trim();
    const mapped = HEADER_MAP[normalized];
    if (mapped) fieldMap.set(i, mapped);
  }

  // Must have at least an email column
  const hasEmail = Array.from(fieldMap.values()).includes('email');
  if (!hasEmail) return [];

  const contacts: ParsedContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const record: Record<string, string> = {};

    for (const [col, field] of Array.from(fieldMap.entries())) {
      if (values[col]?.trim()) {
        record[field] = values[col].trim();
      }
    }

    if (!record.email) continue;

    // Combine firstName + lastName if no full name
    let name = record.name || '';
    if (!name && (record.firstName || record.lastName)) {
      name = [record.firstName, record.lastName].filter(Boolean).join(' ');
    }
    if (!name) name = record.email.split('@')[0];

    contacts.push({
      name,
      email: record.email.toLowerCase(),
      company: record.company || undefined,
      title: record.title || undefined,
    });
  }

  return contacts;
}

/**
 * Parse a single CSV row, handling quoted fields.
 */
function parseRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }

  fields.push(current);
  return fields;
}
