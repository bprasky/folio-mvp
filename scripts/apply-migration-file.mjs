// Apply a single migration.sql file against DIRECT_URL.
// Splits on top-level ';' and runs each statement via $executeRawUnsafe.
// Respects SQL line comments (-- ...), block comments (/* ... */), and DO $$..$$ blocks:
// a ';' inside any of those is NOT a statement terminator.
// Reports each statement's result.
import { PrismaClient } from '@prisma/client';
import { migrationConnectionUrl } from './lib/migrationConnection.mjs';
import fs from 'node:fs';

const path = process.argv[2];
if (!path) { console.error('usage: apply-migration-file.mjs <path>'); process.exit(1); }

const sql = fs.readFileSync(path, 'utf8');

function splitStatements(src) {
  const out = [];
  let buf = '';
  let inDollar = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const two = src.substr(i, 2);

    // End of line comment on newline
    if (inLineComment && c === '\n') {
      inLineComment = false;
      buf += c;
      continue;
    }

    // Start line comment
    if (!inDollar && !inBlockComment && !inLineComment && two === '--') {
      inLineComment = true;
      buf += '--';
      i++;
      continue;
    }

    // Start block comment
    if (!inDollar && !inLineComment && !inBlockComment && two === '/*') {
      inBlockComment = true;
      buf += '/*';
      i++;
      continue;
    }

    // End block comment
    if (inBlockComment && two === '*/') {
      inBlockComment = false;
      buf += '*/';
      i++;
      continue;
    }

    // DO $$ ... $$ toggle
    if (!inLineComment && !inBlockComment && two === '$$') {
      inDollar = !inDollar;
      buf += '$$';
      i++;
      continue;
    }

    buf += c;

    // Statement terminator only outside comments and dollar blocks
    if (c === ';' && !inDollar && !inLineComment && !inBlockComment) {
      const stmt = buf.trim();
      if (stmt && stmt !== ';') out.push(stmt);
      buf = '';
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  // Filter out pure-comment-only chunks
  return out.filter(s =>
    s.replace(/--[^\n]*/g, '')
     .replace(/\/\*[\s\S]*?\*\//g, '')
     .replace(/\s/g, '').length > 0
  );
}

const prisma = new PrismaClient({ datasourceUrl: migrationConnectionUrl({ label: 'apply-migration-file' }) });
const stmts = splitStatements(sql);
console.log('Parsed '+stmts.length+' statement(s).');

for (let i = 0; i < stmts.length; i++) {
  const preview = stmts[i].replace(/\s+/g, ' ').slice(0, 120);
  console.log(`\n[${i+1}/${stmts.length}] ${preview}${stmts[i].length>120?'...':''}`);
  try {
    const n = await prisma.$executeRawUnsafe(stmts[i]);
    console.log(`  ok (rows=${n})`);
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    await prisma.$disconnect();
    process.exit(1);
  }
}

await prisma.$disconnect();
console.log('\nAll statements applied successfully.');
