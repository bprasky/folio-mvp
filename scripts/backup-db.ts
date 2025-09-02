import { execSync } from 'node:child_process';
import { requireEnv } from '../src/lib/env';

try {
  const dbUrl = requireEnv('DATABASE_URL');
  const ts = new Date().toISOString().replace(/[:.]/g,'-');
  const out = `backups/db-backup-${ts}.sql`;

  execSync(`mkdir backups`, { stdio: 'inherit' });
  execSync(`pg_dump "${dbUrl}" > "${out}"`, { stdio: 'inherit' });
  console.log(`✅ Database backup written to ${out}`);
} catch (error) {
  if (error instanceof Error) {
    console.error('❌ Backup failed:', error.message);
  } else {
    console.error('❌ Backup failed: Unknown error');
  }
  process.exit(1);
}
