/**
 * Finish-schedule parser — reads a tabular finish schedule (XLSX or CSV) into
 * structured product rows. This is the deterministic first pass; messy rows can
 * later be enriched with `completeSpecificationWithAI` (src/lib/pdf/aiEnhancement).
 *
 * Finish schedules vary wildly in layout, so we detect the header row and map
 * columns to fields by keyword rather than assuming fixed positions. A workbook
 * is read sheet-by-sheet; a sheet name that reads like a room is used as the
 * room fallback for rows that don't carry their own room column.
 */

export interface FinishScheduleRow {
  name: string;
  brand: string | null;
  category: string | null;
  room: string | null;
  /** Price in cents. */
  price: number | null;
  sku: string | null;
  dimensions: string | null;
  material: string | null;
  finish: string | null;
  url: string | null;
  quantity: number | null;
}

type Field = keyof Omit<FinishScheduleRow, never>;

// Header keyword → field, most specific first so "Item #" maps to sku before
// "Item" maps to name, and "Unit Price" maps to price before anything else.
const FIELD_KEYWORDS: Array<[Field, string[]]> = [
  ['url', ['url', 'link', 'website', 'web address', 'product link', 'source link']],
  ['sku', ['sku', 'model number', 'model no', 'model #', 'item number', 'item no', 'item #', 'part number', 'part #', 'mfr #', 'catalog', 'model']],
  ['price', ['unit price', 'list price', 'price', 'cost', 'msrp', 'amount']],
  ['quantity', ['quantity', 'qty', 'count']],
  ['dimensions', ['dimension', 'dims', 'size', 'measurement']],
  ['room', ['room', 'location', 'space', 'area', 'zone']],
  ['category', ['category', 'classification', 'discipline', 'type']],
  ['brand', ['manufacturer', 'brand', 'vendor', 'supplier', 'mfr', 'maker', 'make']],
  ['material', ['material', 'composition']],
  ['finish', ['finish', 'colour', 'color']],
  ['name', ['product name', 'item name', 'product', 'item', 'fixture', 'description', 'specification', 'spec', 'name']],
];

const ALL_KEYWORDS = FIELD_KEYWORDS.flatMap(([, kws]) => kws);

const ROOM_HINTS = [
  'kitchen', 'bath', 'bathroom', 'powder', 'bedroom', 'living', 'dining', 'family',
  'foyer', 'entry', 'hall', 'office', 'study', 'laundry', 'mudroom', 'closet',
  'pantry', 'stair', 'gym', 'media', 'nursery', 'suite', 'lounge', 'library',
];

/** Coerce any exceljs / papaparse cell value into a trimmed string. */
function cellToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    // exceljs rich text / hyperlink / formula shapes
    if (typeof v.text === 'string') return v.text.trim();
    if (typeof v.hyperlink === 'string') return v.hyperlink.trim();
    if (typeof v.result === 'string' || typeof v.result === 'number') return String(v.result).trim();
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r?.text ?? '').join('').trim();
  }
  return String(value).trim();
}

/** Parse a price cell ("$1,234.50", "1234") into cents, or null. */
function parsePriceCents(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const dollars = parseFloat(cleaned);
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

function parseQuantity(raw: string): number | null {
  if (!raw) return null;
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** A header cell is recognized if it contains any known field keyword. */
function isHeaderCell(cell: string): boolean {
  const lower = cell.toLowerCase();
  return ALL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Find the header row: the first row (within the first ~15) that has at least
 * two recognizable column names. Returns its index, or -1 if none looks like a
 * header (in which case the sheet is skipped).
 */
function findHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, 15);
  let best = -1;
  let bestScore = 1; // require at least 2 matches
  for (let i = 0; i < limit; i++) {
    const score = rows[i].filter(isHeaderCell).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Map each header column index to a field (first-match wins, no duplicates). */
function mapColumns(header: string[]): Map<number, Field> {
  const used = new Set<Field>();
  const map = new Map<number, Field>();
  for (let col = 0; col < header.length; col++) {
    const lower = header[col].toLowerCase().trim();
    if (!lower) continue;
    for (const [field, keywords] of FIELD_KEYWORDS) {
      if (used.has(field)) continue;
      if (keywords.some((kw) => lower.includes(kw))) {
        map.set(col, field);
        used.add(field);
        break;
      }
    }
  }
  return map;
}

function looksLikeRoom(sheetName: string): boolean {
  const lower = sheetName.toLowerCase();
  return ROOM_HINTS.some((h) => lower.includes(h));
}

/** Turn one sheet's raw rows into FinishScheduleRow[]. */
function parseSheet(rows: string[][], sheetName: string): FinishScheduleRow[] {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx === -1) return [];

  const columns = mapColumns(rows[headerIdx]);
  if (![...columns.values()].includes('name')) return []; // no product column, nothing to import

  const roomFallback = looksLikeRoom(sheetName) ? sheetName.trim() : null;
  const out: FinishScheduleRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c)) continue;

    const get = (field: Field): string => {
      for (const [col, f] of columns) if (f === field) return row[col] ?? '';
      return '';
    };

    const name = get('name');
    if (!name) continue; // a product row must at least name the product

    out.push({
      name,
      brand: get('brand') || null,
      category: get('category') || null,
      room: get('room') || roomFallback,
      price: parsePriceCents(get('price')),
      sku: get('sku') || null,
      dimensions: get('dimensions') || null,
      material: get('material') || null,
      finish: get('finish') || null,
      url: get('url') || null,
      quantity: parseQuantity(get('quantity')),
    });
  }

  return out;
}

async function readCsv(buffer: Buffer): Promise<string[][]> {
  const Papa = (await import('papaparse')).default;
  const parsed = Papa.parse<string[]>(buffer.toString('utf8'), {
    skipEmptyLines: 'greedy',
  });
  return (parsed.data as unknown[][]).map((r) => (r as unknown[]).map((c) => cellToString(c)));
}

async function readXlsx(buffer: Buffer): Promise<Array<{ name: string; rows: string[][] }>> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheets: Array<{ name: string; rows: string[][] }> = [];
  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      // row.values is 1-indexed with a leading hole; normalize to a dense array.
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map((c) => cellToString(c)));
    });
    if (rows.length) sheets.push({ name: ws.name, rows });
  });
  return sheets;
}

/**
 * Parse a finish-schedule file (XLSX or CSV) into structured product rows.
 * Throws with a friendly message for unsupported types.
 */
export async function parseFinishSchedule(
  buffer: Buffer,
  fileName: string,
): Promise<FinishScheduleRow[]> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.csv')) {
    return parseSheet(await readCsv(buffer), 'Sheet');
  }

  if (lower.endsWith('.xlsx')) {
    const sheets = await readXlsx(buffer);
    return sheets.flatMap((s) => parseSheet(s.rows, s.name));
  }

  if (lower.endsWith('.xls')) {
    throw new Error('Legacy .xls files aren’t supported — please re-save as .xlsx or .csv.');
  }

  throw new Error('Unsupported finish-schedule file. Upload an .xlsx or .csv.');
}
