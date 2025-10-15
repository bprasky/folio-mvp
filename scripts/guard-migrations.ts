import { execSync } from 'node:child_process';

const dbUrl = process.env.DATABASE_URL || '';
const prodUrl = process.env.PROD_DATABASE_URL || '';
const shadowUrl = process.env.SHADOW_DATABASE_URL || '';

function fail(msg: string) { console.error(`\n🚫 ${msg}\n`); process.exit(1); }

// 1) Prevent accidental prod = dev
if (dbUrl && prodUrl && dbUrl === prodUrl) {
  fail('DATABASE_URL and PROD_DATABASE_URL are identical. Refusing to proceed.');
}
if (shadowUrl && (shadowUrl === dbUrl || shadowUrl === prodUrl)) {
  fail('SHADOW_DATABASE_URL must differ from DATABASE_URL and PROD_DATABASE_URL.');
}

// 2) Generate diff and inspect for destructive SQL
try {
  const script = execSync(
    `npx prisma migrate diff --from-url="${dbUrl}" --to-schema-datamodel="prisma/schema.prisma" --script`,
    { stdio: ['ignore', 'pipe', 'pipe'] }
  ).toString();

  const isDestructive = /\bDROP\s+(TABLE|COLUMN)\b/i.test(script) || /\bALTER\s+TABLE\b.*\bDROP\b/i.test(script);
  if (isDestructive) {
    console.error('\n--- Proposed Migration Script ---\n');
    console.error(script);
    fail('Destructive changes detected in Prisma migration diff. Aborting.');
  }
} catch (e: any) {
  fail(`Failed to compute Prisma diff: ${e.message || e}`);
}

console.log('✅ Migration guard passed (no destructive changes detected).');








