// ============================================================================
// Env files, for scripts that are invoked bare.
//
// Most scripts here are run by hand and documented as
// `node --env-file=.env.local scripts/whatever.mjs`. That is fine for a tool a
// person types. It does not work for `db:guard`, which sits inside
// `npm run db:guard && prisma migrate dev` in three chains and is invoked with
// no flags and no arguments — there is nowhere to put `--env-file`.
//
// The asymmetry that made this necessary: `prisma migrate deploy` loads `.env`
// itself, so without this the gate would refuse for want of a connection while
// the command it gates connected happily. A guard that fails closed on its own
// blind spot is not protecting anything; it is just in the way.
//
// Precedence follows Next.js, which is what the app itself obeys: `.env.local`
// beats `.env`, and a variable already present in the real environment beats
// both. dotenv's default is not to override, so load order alone expresses it.
// ============================================================================

import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';

/**
 * Load the project's env files into process.env, nearest-wins.
 *
 * Returns the files it actually read, so a caller can say which one supplied a
 * connection — the difference between "no DIRECT_URL anywhere" and "DIRECT_URL
 * is in a file this script never looked at" is the whole of the error message.
 */
export function loadProjectEnv(cwd = process.cwd()) {
  const loaded = [];
  // Order matters: dotenv does not override an already-set key, so the first
  // file to define a variable wins.
  for (const name of ['.env.local', '.env']) {
    const file = path.join(cwd, name);
    if (!existsSync(file)) continue;
    config({ path: file, quiet: true });
    loaded.push(name);
  }
  return loaded;
}
