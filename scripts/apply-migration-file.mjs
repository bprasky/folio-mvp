// Apply a single migration.sql file against DIRECT_URL.
// Splits on top-level ';' and runs each statement via $executeRawUnsafe.
// Reports each statement's result.
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';

const path = process.argv[2];
if (!path) { console.error('usage: apply-migration-file.mjs <path>'); process.exit(1); }

const sql = fs.readFileSync(path, 'utf8');

// Strip SQL line comments, keep DO $$..$$ blocks intact.
// Split on semicolons that are NOT inside a DO $$ ... $$ block.
function splitStatements(src) {
  const out = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < src.length; i++) {
    const two = src.substr(i, 2);
    if (two === '$$') { inDollar = !inDollar; buf += '$$'; i++; continue; }
    const c = src[i];
    buf += c;
    if (c === ';' && !inDollar) {
      const stmt = buf.trim();
      if (stmt && stmt !== ';') out.push(stmt);
      buf = '';
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  // Filter out pure-comment-only chunks
  return out.filter(s => s.replace(/--[^\n]*\n/g, '').replace(/\s/g, '').length > 0);
}

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });
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
