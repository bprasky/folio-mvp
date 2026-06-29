/**
 * Finish Schedule parse stage — VALIDATION HARNESS ONLY.
 *
 * Pure functions. Reads an uploaded finish-schedule file and returns structured
 * rows. Persists nothing, touches no schema, writes no DB. Implements Deliverable 1
 * of the "finish schedule parse + locate" validation harness.
 *
 * Format detection by extension + mime:
 *   - .xlsx / spreadsheetml  -> exceljs
 *   - .csv  / text/csv       -> papaparse
 *   - .pdf  / application/pdf -> pdf-parse (native getTable, text fallback)
 *
 * Real finish schedules are messy. We deliberately handle:
 *   - header-row detection (header is rarely row 1),
 *   - room labels that appear as section headers spanning rows (not a per-row column),
 *   - vertically merged room cells (fill-down),
 *   - a notes column doing double duty.
 * Rows we cannot classify are NOT dropped — they go to `unparsed` with a sourceRef
 * and a reason so coverage is visible.
 */

import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
// pdf-parse v2 exposes a PDFParse class (not the v1 default function).
import { PDFParse } from 'pdf-parse';

export type ScheduleRow = {
  roomLabel: string;
  productDescription: string;
  vendor?: string;
  sku?: string;
  /** Back-reference to originating sheet/row/page for debugging against the source. */
  sourceRef: string;
};

export type UnparsedRow = {
  sourceRef: string;
  reason: string;
  /** Raw cells/text retained for debugging (harness-only, never persisted). */
  raw: string[];
};

export type ParseResult = {
  rows: ScheduleRow[];
  unparsed: UnparsedRow[];
  /** Which detector ran, for the report. */
  format: 'xlsx' | 'csv' | 'pdf-table' | 'pdf-text' | 'unknown';
};

/** A format-agnostic record: a positional row of cells plus its source reference. */
type RawRecord = { ref: string; cells: string[] };

// ---- column keyword matchers ----------------------------------------------

const ROOM_RE = /\b(room|space|area|location|level|floor)\b/i;
const DESC_RE = /\b(product|description|item|material|finish|fixture|spec|element|selection)\b/i;
const VENDOR_RE = /\b(vendor|brand|manufacturer|mfr|supplier|maker|source|line)\b/i;
// No trailing \b: tokens like "Item #" end in a non-word char, which would
// otherwise fail a closing word boundary.
const SKU_RE = /\b(sku|model|item\s*(#|no|number)|product\s*(code|#|no)|part\s*(#|no|number)|catalog)/i;
const NOTES_RE = /\b(note|notes|comment|remark|detail)\b/i;

// ---- public entry ----------------------------------------------------------

export async function parseFinishSchedule(filePath: string, mime?: string): Promise<ParseResult> {
  const ext = path.extname(filePath).toLowerCase();
  const m = (mime || '').toLowerCase();

  if (ext === '.xlsx' || ext === '.xlsm' || m.includes('spreadsheetml') || m.includes('ms-excel')) {
    return parseXlsx(filePath);
  }
  if (ext === '.csv' || m.includes('text/csv') || m === 'application/csv') {
    return parseCsv(filePath);
  }
  if (ext === '.pdf' || m.includes('pdf')) {
    return parsePdf(filePath);
  }
  // Unknown: try CSV (most forgiving) but flag it.
  const fallback = await parseCsv(filePath);
  return { ...fallback, format: 'unknown' };
}

// ---- xlsx ------------------------------------------------------------------

async function parseXlsx(filePath: string): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const records: RawRecord[] = [];
  wb.eachSheet((ws) => {
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // cell.text resolves rich text / formula display / hyperlink labels.
        // Merged non-master cells return '' here; we recover rooms via fill-down.
        cells[colNumber - 1] = (cell.text ?? '').toString().trim();
      });
      records.push({ ref: `xlsx:${ws.name}:R${rowNumber}`, cells: normalizeCells(cells) });
    });
  });

  return { ...classifyTabular(records), format: 'xlsx' };
}

// ---- csv -------------------------------------------------------------------

async function parseCsv(filePath: string): Promise<ParseResult> {
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const records: RawRecord[] = (parsed.data as string[][]).map((cells, i) => ({
    ref: `csv:R${i + 1}`,
    cells: normalizeCells((cells || []).map((c) => (c ?? '').toString().trim())),
  }));
  return { ...classifyTabular(records), format: 'csv' };
}

// ---- pdf -------------------------------------------------------------------

async function parsePdf(filePath: string): Promise<ParseResult> {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const tableResult = await parser.getTable();
    const records: RawRecord[] = [];
    for (const page of tableResult.pages) {
      page.tables.forEach((table, tIdx) => {
        (table as string[][]).forEach((cells, rIdx) => {
          records.push({
            ref: `pdf:P${page.num}:T${tIdx + 1}:R${rIdx + 1}`,
            cells: normalizeCells((cells || []).map((c) => (c ?? '').toString().trim())),
          });
        });
      });
    }

    if (records.length > 0) {
      return { ...classifyTabular(records), format: 'pdf-table' };
    }

    // No vector table grid detected — fall back to positioned text lines.
    const textResult = await parser.getText();
    return { ...classifyPdfText(textResult.pages), format: 'pdf-text' };
  } finally {
    await parser.destroy();
  }
}

/**
 * PDF text fallback. Without a table grid we cannot reliably map columns, so we
 * are conservative: lines that look like room section headers update the current
 * room; lines beneath a known room become product rows (description = full line);
 * anything before a room header or that looks like page chrome goes to `unparsed`.
 */
function classifyPdfText(pages: Array<{ num: number; text: string }>): Omit<ParseResult, 'format'> {
  const rows: ScheduleRow[] = [];
  const unparsed: UnparsedRow[] = [];
  let currentRoom = '';

  for (const page of pages) {
    const lines = page.text.split(/\r?\n/);
    lines.forEach((rawLine, i) => {
      const line = rawLine.trim();
      const ref = `pdf:P${page.num}:L${i + 1}`;
      if (!line) return;
      if (/^\s*page\s+\d+/i.test(line) || /^\d+$/.test(line)) return; // page chrome

      const asRoom = roomFromHeaderLine(line);
      if (asRoom) {
        currentRoom = asRoom;
        return;
      }
      if (!currentRoom) {
        unparsed.push({ sourceRef: ref, reason: 'pdf text line before any room header', raw: [line] });
        return;
      }
      rows.push({ roomLabel: currentRoom, productDescription: line, sourceRef: ref });
    });
  }

  return { rows, unparsed };
}

function roomFromHeaderLine(line: string): string | null {
  // "Room: Kitchen", "KITCHEN", "Primary Bath —" style banners.
  const labelled = line.match(/^\s*(?:room|space|area)\s*[:\-]\s*(.+)$/i);
  if (labelled) return labelled[1].trim();
  // All-caps short banner with no digits and few words.
  if (/^[A-Z0-9 &'/\-]{2,40}$/.test(line) && /[A-Z]/.test(line) && line.split(/\s+/).length <= 5 && !/\d{2,}/.test(line)) {
    return line.trim();
  }
  return null;
}

// ---- shared tabular classifier --------------------------------------------

type ColMap = { room: number; desc: number; vendor: number; sku: number; notes: number };

function classifyTabular(records: RawRecord[]): Omit<ParseResult, 'format'> {
  const rows: ScheduleRow[] = [];
  const unparsed: UnparsedRow[] = [];

  // Drop leading/trailing fully-empty records from consideration but keep refs.
  const { headerIdx, colMap, maxCols } = detectHeader(records);

  if (headerIdx === -1) {
    // No recognizable header. If the data is effectively single-column, treat it
    // as a list with room section headers. Otherwise we cannot map columns.
    if (maxCols <= 1) {
      return classifySingleColumn(records);
    }
    for (const rec of records) {
      if (isEmpty(rec.cells)) continue;
      unparsed.push({
        sourceRef: rec.ref,
        reason: 'no recognizable header row; cannot map columns',
        raw: rec.cells,
      });
    }
    return { rows, unparsed };
  }

  let currentRoom = '';
  let roomFillDown = '';

  for (let i = headerIdx + 1; i < records.length; i++) {
    const rec = records[i];
    const cells = rec.cells;
    if (isEmpty(cells)) continue;

    const nonEmpty = cells.filter((c) => c && c.trim()).length;

    // Section-header row: a single non-empty cell that is NOT sitting in the
    // description column. Establishes the current room for following rows.
    if (nonEmpty === 1) {
      const idx = cells.findIndex((c) => c && c.trim());
      if (idx !== colMap.desc) {
        currentRoom = cells[idx].trim();
        roomFillDown = '';
        continue;
      }
    }

    // Per-row room column (with fill-down for vertically merged room cells).
    if (colMap.room >= 0) {
      const v = (cells[colMap.room] || '').trim();
      if (v) roomFillDown = v;
    }
    const roomLabel = (colMap.room >= 0 ? roomFillDown : '') || currentRoom;

    let description = colMap.desc >= 0 ? (cells[colMap.desc] || '').trim() : '';
    // Notes column doing double duty: if no description, borrow notes.
    if (!description && colMap.notes >= 0) {
      description = (cells[colMap.notes] || '').trim();
    }
    const vendor = colMap.vendor >= 0 ? (cells[colMap.vendor] || '').trim() : '';
    const sku = colMap.sku >= 0 ? (cells[colMap.sku] || '').trim() : '';

    if (!description) {
      unparsed.push({ sourceRef: rec.ref, reason: 'no product description in row', raw: cells });
      continue;
    }
    if (!roomLabel) {
      unparsed.push({ sourceRef: rec.ref, reason: 'product has no room context', raw: cells });
      continue;
    }

    rows.push({
      roomLabel,
      productDescription: description,
      ...(vendor ? { vendor } : {}),
      ...(sku ? { sku } : {}),
      sourceRef: rec.ref,
    });
  }

  return { rows, unparsed };
}

/** Single-column lists: room section headers + product lines. */
function classifySingleColumn(records: RawRecord[]): Omit<ParseResult, 'format'> {
  const rows: ScheduleRow[] = [];
  const unparsed: UnparsedRow[] = [];
  let currentRoom = '';

  for (const rec of records) {
    const val = (rec.cells[0] || '').trim();
    if (!val) continue;
    const asRoom = roomFromHeaderLine(val);
    if (asRoom) {
      currentRoom = asRoom;
      continue;
    }
    if (!currentRoom) {
      unparsed.push({ sourceRef: rec.ref, reason: 'product before any room header', raw: rec.cells });
      continue;
    }
    rows.push({ roomLabel: currentRoom, productDescription: val, sourceRef: rec.ref });
  }
  return { rows, unparsed };
}

/**
 * Scan the first rows for the one that best matches column header keywords.
 * Returns the header index, a column map, and the observed max column count.
 */
function detectHeader(records: RawRecord[]): { headerIdx: number; colMap: ColMap; maxCols: number } {
  const maxCols = records.reduce((m, r) => Math.max(m, r.cells.length), 0);
  const scanTo = Math.min(records.length, 15);
  let bestIdx = -1;
  let bestScore = 0;
  let bestMap: ColMap = { room: -1, desc: -1, vendor: -1, sku: -1, notes: -1 };

  for (let i = 0; i < scanTo; i++) {
    const cells = records[i].cells;
    if (isEmpty(cells)) continue;
    const map: ColMap = { room: -1, desc: -1, vendor: -1, sku: -1, notes: -1 };
    let score = 0;
    cells.forEach((cell, idx) => {
      const c = (cell || '').trim();
      if (!c) return;
      if (map.sku < 0 && SKU_RE.test(c)) { map.sku = idx; score++; return; }
      if (map.vendor < 0 && VENDOR_RE.test(c)) { map.vendor = idx; score++; return; }
      if (map.room < 0 && ROOM_RE.test(c)) { map.room = idx; score++; return; }
      if (map.notes < 0 && NOTES_RE.test(c)) { map.notes = idx; score++; return; }
      if (map.desc < 0 && DESC_RE.test(c)) { map.desc = idx; score++; return; }
    });
    // A header must at least identify a description (or notes) column.
    if (score > bestScore && (map.desc >= 0 || map.notes >= 0)) {
      bestScore = score;
      bestIdx = i;
      bestMap = map;
    }
  }

  return { headerIdx: bestIdx, colMap: bestMap, maxCols };
}

// ---- helpers ---------------------------------------------------------------

/** Trim trailing empty cells so positional logic stays stable across formats. */
function normalizeCells(cells: string[]): string[] {
  const out = cells.map((c) => (c ?? '').toString());
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

function isEmpty(cells: string[]): boolean {
  return !cells.some((c) => c && c.trim());
}
