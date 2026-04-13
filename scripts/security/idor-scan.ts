#!/usr/bin/env tsx
/**
 * IDOR / Authorization-Gap Static Scanner
 *
 * Heuristic static analyzer for `src/app/api/** /route.ts`. Detects missing auth
 * checks and unscoped Prisma queries that enable cross-tenant data access.
 *
 * Usage:
 *   tsx scripts/security/idor-scan.ts            # write report, exit 0
 *   tsx scripts/security/idor-scan.ts --ci       # exit 1 if any Critical finding
 *   tsx scripts/security/idor-scan.ts --out PATH # custom report path
 *   tsx scripts/security/idor-scan.ts --root DIR # scan a different tree
 *
 * Allowlist (top 10 lines of a route file):
 *   // @idor-allow: public-read reason="Public profile"
 *   // @idor-allow: admin-middleware reason="Auth enforced in middleware.ts"
 *   // @idor-allow: IDOR003 reason="where uses slug not id"
 *   // @idor-allow: all reason="..."
 *
 * Rules: IDOR001..IDOR007 — see README or the RULES const below.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

interface Finding {
  ruleId: string;
  severity: Severity;
  file: string;
  handlerName: string;
  line: number;
  message: string;
  snippet: string;
}

interface Handler {
  name: string;
  startLine: number; // 1-based line in file
  startOffset: number; // char offset of `{` opening body
  endOffset: number; // char offset just after matching `}`
  body: string;
}

interface CliArgs {
  ci: boolean;
  out: string;
  root: string;
}

// --------------------------------------------------------------------------
// Regexes & constants
// --------------------------------------------------------------------------

const OWNERSHIP_FIELDS =
  /\b(userId|ownerId|designerId|designerOrgId|organizationId|orgId|buyerId|vendorOrgId|createdById|authorId|accountId|tenantId)\b/;

// Recognize ownership/authz helpers by naming convention rather than an
// explicit list. Catches any `assert*`, `canAccess*`, `canPerform*`,
// `check*Access`, `require(Admin|Role|Auth|Member|Login)` helper, plus
// project-specific helpers that don't fit the convention.
const AUTHZ_HELPERS =
  /\b(assert[A-Z]\w*|can[A-Z]\w*|require(?:Admin|Role|Auth|Member|Login)|check[A-Z]\w*Access|getProjectAccess|verifyToken|verifySignedUrl|jwt\.verify)\s*\(/;

const SESSION_CALL =
  /getServerSession\s*\(|from\s+['"]next-auth['"]|getUserIdFromRequest\s*\(|from\s+['"]@\/lib\/apiAuth['"]/;

const ADMIN_ROLE_CHECK =
  /role\s*(?:!==|===)\s*['"]ADMIN['"]|role\s*:\s*['"]ADMIN['"]|requireAdmin\s*\(|isAdmin\s*\(|canAccessAdmin\s*\(/;

/**
 * Recognizes the "post-fetch ownership check" pattern, e.g.
 *   if (event.hostProfile?.userId !== session.user.id) return 403;
 *   if (project.ownerId === session.user.id) { ... }
 * When a handler loads a parent resource, then compares one of its ownership
 * fields against session.user.id, we treat subsequent queries scoped to that
 * resource as ownership-checked.
 */
// Field-on-left orientation: `record.ownerId === session.user.id`
const POST_FETCH_OWNER_CHECK_LHS =
  /\.\s*(?:\w+Id)\s*(?:!==|===)\s*(?:session[?.]?\.user[?.]?\.id|\buserId\b|user[?.]?\.id)\b/;
// Field-on-right orientation: `user.id === record.ownerId`
const POST_FETCH_OWNER_CHECK_RHS =
  /(?:session[?.]?\.user[?.]?\.id|\buserId\b|user[?.]?\.id)\s*(?:!==|===)\s*\w+\.\s*\w+Id\b/;

/**
 * Recognizes handlers that have already done a session-scoped FETCH of the
 * record, e.g. `prisma.importSession.findFirst({ where: { id: sessionId, userId } })`.
 * Once a handler has fetched a record with a where clause that includes an
 * ownership field (userId, ownerId, etc.), subsequent queries in the same
 * handler can safely use ids derived from that fetch. The scanner can't
 * trace the derivation, but the handler-level presence of the scoped fetch
 * is strong enough signal.
 */
const SCOPED_FETCH =
  /prisma\.\w+\.(?:findUnique|findFirst|findMany|count)\s*\(\s*\{[\s\S]{0,600}?where\s*:\s*\{[\s\S]{0,300}?\b(?:userId|ownerId|createdById|designerId|authorId|buyerId)\b/;

const HANDLER_DECL =
  /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;

const PRISMA_QUERY =
  /(?:prisma|db)\.(\w+)\.(findUnique|findFirst|update|delete|upsert|updateMany|deleteMany)\s*\(\s*\{/g;

const RAW_SQL = /(?:prisma|db)\.\$(?:queryRaw|executeRaw)/;

// Allowlist token → rule IDs it suppresses.
const ALLOWLIST_GROUPS: Record<string, string[]> = {
  'public-read': ['IDOR002', 'IDOR005'],
  'admin-middleware': ['IDOR001'],
  'token-access': ['IDOR002', 'IDOR003'],
  all: [
    'IDOR001',
    'IDOR002',
    'IDOR003',
    'IDOR004',
    'IDOR005',
    'IDOR006',
    'IDOR007',
  ],
};

const SEVERITY_RANK: Record<Severity, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    ci: false,
    out: 'reports/idor-scan.md',
    root: 'src/app/api',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ci') args.ci = true;
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--root') args.root = argv[++i];
  }
  return args;
}

// --------------------------------------------------------------------------
// Route discovery
// --------------------------------------------------------------------------

function walkRoutes(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name === 'route.ts') out.push(full);
    }
  }
  return out.sort();
}

// --------------------------------------------------------------------------
// Handler extraction (brace counting)
// --------------------------------------------------------------------------

function extractHandlers(source: string): Handler[] {
  const handlers: Handler[] = [];
  HANDLER_DECL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HANDLER_DECL.exec(source))) {
    const name = m[1];
    const declIdx = m.index;
    // find opening `{` of the function body (skip argument list first)
    let i = declIdx + m[0].length;
    let parenDepth = 1; // we're inside `(` opened by the match
    while (i < source.length && parenDepth > 0) {
      const c = source[i++];
      if (c === '(') parenDepth++;
      else if (c === ')') parenDepth--;
    }
    // optional `: ReturnType` annotation, then `{`
    while (i < source.length && source[i] !== '{') i++;
    if (i >= source.length) continue;
    const bodyStart = i;
    // brace-match to find end, treating string/template/comments correctly-ish
    let depth = 0;
    let j = bodyStart;
    let inStr: '"' | "'" | '`' | null = null;
    let inLine = false;
    let inBlock = false;
    while (j < source.length) {
      const c = source[j];
      const next = source[j + 1];
      if (inLine) {
        if (c === '\n') inLine = false;
        j++;
        continue;
      }
      if (inBlock) {
        if (c === '*' && next === '/') {
          inBlock = false;
          j += 2;
          continue;
        }
        j++;
        continue;
      }
      if (inStr) {
        if (c === '\\') {
          j += 2;
          continue;
        }
        if (c === inStr) inStr = null;
        j++;
        continue;
      }
      if (c === '/' && next === '/') {
        inLine = true;
        j += 2;
        continue;
      }
      if (c === '/' && next === '*') {
        inBlock = true;
        j += 2;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        inStr = c as '"' | "'" | '`';
        j++;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
      j++;
    }
    const bodyEnd = j;
    const body = source.slice(bodyStart, bodyEnd);
    const startLine = source.slice(0, declIdx).split('\n').length;
    handlers.push({
      name,
      startLine,
      startOffset: bodyStart,
      endOffset: bodyEnd,
      body,
    });
  }
  return handlers;
}

// --------------------------------------------------------------------------
// Prisma `where` clause extraction
// --------------------------------------------------------------------------

interface PrismaCall {
  model: string;
  method: string;
  whereText: string; // text between `where: {` and matching `}`, or '' if not found
  callLine: number; // line offset within handler body (1-based)
}

function extractPrismaCalls(body: string): PrismaCall[] {
  const calls: PrismaCall[] = [];
  PRISMA_QUERY.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PRISMA_QUERY.exec(body))) {
    const model = m[1];
    const method = m[2];
    const argsStart = m.index + m[0].length - 1; // position of `{`
    // find matching `}` for the args object
    const argsEnd = matchBrace(body, argsStart);
    if (argsEnd < 0) continue;
    const args = body.slice(argsStart + 1, argsEnd);
    const whereText = findWhereClause(args);
    const callLine = body.slice(0, m.index).split('\n').length;
    calls.push({ model, method, whereText, callLine });
  }
  return calls;
}

function matchBrace(s: string, openIdx: number): number {
  if (s[openIdx] !== '{') return -1;
  let depth = 0;
  let inStr: '"' | "'" | '`' | null = null;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c as '"' | "'" | '`';
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findWhereClause(args: string): string {
  // locate `where:` at top level, then brace-match the following `{`
  let i = 0;
  let depth = 0;
  let inStr: '"' | "'" | '`' | null = null;
  while (i < args.length) {
    const c = args[i];
    if (inStr) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c as '"' | "'" | '`';
      i++;
      continue;
    }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    if (
      depth === 0 &&
      args.slice(i, i + 6) === 'where:' &&
      /\W/.test(args[i - 1] ?? ' ')
    ) {
      // skip to `{`
      let j = i + 6;
      while (j < args.length && args[j] !== '{') {
        if (!/\s/.test(args[j])) break; // not an object literal — give up
        j++;
      }
      if (args[j] !== '{') return '';
      const end = matchBrace(args, j);
      if (end < 0) return '';
      return args.slice(j, end + 1);
    }
    i++;
  }
  return '';
}

// --------------------------------------------------------------------------
// Rules
// --------------------------------------------------------------------------

function isDynamicRoute(file: string): boolean {
  return /\[[^\]]+\]/.test(file);
}

function isAdminRoute(file: string): boolean {
  return /(^|\/)src\/app\/api\/admin\//.test(file.replace(/\\/g, '/'));
}

function handlerHasSession(body: string): boolean {
  return SESSION_CALL.test(body);
}

function handlerHasAuthzHelper(body: string): boolean {
  return AUTHZ_HELPERS.test(body);
}

function handlerHasAdminRoleCheck(body: string): boolean {
  return ADMIN_ROLE_CHECK.test(body);
}

function handlerHasPostFetchOwnerCheck(body: string): boolean {
  return (
    POST_FETCH_OWNER_CHECK_LHS.test(body) ||
    POST_FETCH_OWNER_CHECK_RHS.test(body)
  );
}

function handlerHasMembershipCheck(body: string): boolean {
  return SCOPED_FETCH.test(body);
}

/**
 * A `where` clause is considered "self-scoped" if it references `session.user`
 * (lookup of the caller's own record).
 */
function whereIsSelfScoped(whereText: string): boolean {
  return /session[?.]?\.user/.test(whereText);
}

function whereIsIdOnly(
  whereText: string,
  selfAliases: Set<string> = new Set(),
): boolean {
  if (!whereText) return false;
  // strip braces + whitespace, keep only key names at the top level
  // heuristic: extract top-level keys of the where object
  const inner = whereText.replace(/^\{/, '').replace(/\}$/, '');
  const topKeys = topLevelKeys(inner);
  if (topKeys.length === 0) return false;
  if (!topKeys.some((k) => k === 'id' || /Id$/.test(k))) return false;
  // self-scoped lookups are safe even if only `id` is mentioned
  if (whereIsSelfScoped(whereText)) return false;
  // Local aliases of session.user.id (e.g. `const userId = session.user.id`)
  // count as self-scoping when used as a value in the where clause.
  for (const alias of selfAliases) {
    const re = new RegExp(`:\\s*${alias}\\b`);
    if (re.test(whereText)) return false;
  }
  // if any ownership field is mentioned anywhere in the where, it's scoped
  if (OWNERSHIP_FIELDS.test(whereText)) return false;
  return true;
}

/**
 * Collect local variable names that are assigned from session.user.id, so
 * that subsequent `where: { id: <alias> }` clauses are recognized as
 * self-scoped. Catches common Folio patterns like:
 *   const userId = session.user.id;
 *   const followerId = session.user.id;
 *   const { id: currentUserId } = session.user;
 */
function extractSelfAliases(body: string): Set<string> {
  const out = new Set<string>();
  const re1 = /\bconst\s+(\w+)\s*=\s*session[?.]?\.user[?.]?\.id\b/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(body))) out.add(m[1]);
  const re2 = /\bconst\s+\{\s*id\s*:\s*(\w+)\s*\}\s*=\s*session[?.]?\.user\b/g;
  while ((m = re2.exec(body))) out.add(m[1]);
  return out;
}

function topLevelKeys(objInner: string): string[] {
  const keys: string[] = [];
  let i = 0;
  let depth = 0;
  let inStr: '"' | "'" | '`' | null = null;
  let tokenStart = -1;
  while (i < objInner.length) {
    const c = objInner[i];
    if (inStr) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c as '"' | "'" | '`';
      i++;
      continue;
    }
    if (c === '{' || c === '[' || c === '(') {
      depth++;
      i++;
      continue;
    }
    if (c === '}' || c === ']' || c === ')') {
      depth--;
      i++;
      continue;
    }
    if (depth === 0) {
      if (c === ':' && tokenStart >= 0) {
        const key = objInner.slice(tokenStart, i).trim();
        if (/^[A-Za-z_$][\w$]*$/.test(key)) keys.push(key);
        tokenStart = -1;
        // skip value until comma at depth 0
        i++;
        let vDepth = 0;
        let vStr: '"' | "'" | '`' | null = null;
        while (i < objInner.length) {
          const cc = objInner[i];
          if (vStr) {
            if (cc === '\\') {
              i += 2;
              continue;
            }
            if (cc === vStr) vStr = null;
            i++;
            continue;
          }
          if (cc === '"' || cc === "'" || cc === '`') {
            vStr = cc as '"' | "'" | '`';
            i++;
            continue;
          }
          if (cc === '{' || cc === '[' || cc === '(') vDepth++;
          else if (cc === '}' || cc === ']' || cc === ')') vDepth--;
          else if (cc === ',' && vDepth === 0) {
            i++;
            break;
          }
          i++;
        }
        continue;
      }
      if (/\S/.test(c) && tokenStart < 0) tokenStart = i;
      if (c === ',' || /\s/.test(c)) {
        // token boundary without a colon (shorthand) — ignore
        if (tokenStart >= 0 && c === ',') tokenStart = -1;
      }
    }
    i++;
  }
  return keys;
}

// --------------------------------------------------------------------------
// Allowlist
// --------------------------------------------------------------------------

function parseAllowlist(source: string): {
  rules: Set<string>;
  reasons: Map<string, string>;
} {
  const rules = new Set<string>();
  const reasons = new Map<string, string>();
  const head = source.split('\n').slice(0, 10).join('\n');
  const re = /@idor-allow:\s*(\S+)(?:\s+reason="([^"]*)")?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(head))) {
    const token = m[1];
    const reason = m[2] ?? '';
    const expanded = ALLOWLIST_GROUPS[token] ?? [token];
    for (const r of expanded) {
      rules.add(r);
      if (reason) reasons.set(r, reason);
    }
  }
  return { rules, reasons };
}

// --------------------------------------------------------------------------
// Scan a single file
// --------------------------------------------------------------------------

function scanFile(absPath: string, root: string): Finding[] {
  const source = fs.readFileSync(absPath, 'utf8');
  const rel = path.relative(root, absPath).replace(/\\/g, '/');
  const allow = parseAllowlist(source);
  const findings: Finding[] = [];
  const handlers = extractHandlers(source);
  const dynamic = isDynamicRoute(rel);
  const admin = isAdminRoute(rel);

  const push = (f: Finding) => {
    if (allow.rules.has(f.ruleId)) return;
    findings.push(f);
  };

  for (const h of handlers) {
    const body = h.body;
    const hasSession = handlerHasSession(body);
    const hasHelper = handlerHasAuthzHelper(body);
    const hasAdminCheck = handlerHasAdminRoleCheck(body);
    const hasPostFetchOwner = handlerHasPostFetchOwnerCheck(body);
    const hasMembership = handlerHasMembershipCheck(body);
    const selfAliases = extractSelfAliases(body);
    // A post-fetch ownership check (e.g. `event.hostProfile.userId === session.user.id`)
    // or a membership-table query (`prisma.organizationUser.findFirst({ where: { userId: session.user.id, ... } })`)
    // is treated as equivalent to calling an authz helper for per-row rules.
    const hasOwnerScope = hasHelper || hasPostFetchOwner || hasMembership;
    const isMutating = h.name !== 'GET';
    const snippet = firstNonEmptyLines(body, 3);

    // IDOR001: admin route missing admin gate
    if (admin && !hasAdminCheck && !hasHelper && !hasSession) {
      push({
        ruleId: 'IDOR001',
        severity: 'Critical',
        file: rel,
        handlerName: h.name,
        line: h.startLine,
        message: `Admin route handler ${h.name} has no session, role check, or authz helper.`,
        snippet,
      });
    } else if (admin && !hasAdminCheck && !hasHelper && hasSession) {
      push({
        ruleId: 'IDOR001',
        severity: 'Critical',
        file: rel,
        handlerName: h.name,
        line: h.startLine,
        message: `Admin route handler ${h.name} authenticates but never verifies ADMIN role.`,
        snippet,
      });
    }

    // IDOR002: dynamic-param route with no auth at all
    if (dynamic && !hasSession && !hasHelper) {
      push({
        ruleId: 'IDOR002',
        severity: 'Critical',
        file: rel,
        handlerName: h.name,
        line: h.startLine,
        message: `Dynamic-param route handler ${h.name} has no session check or authz helper — IDOR.`,
        snippet,
      });
    }

    // IDOR005: non-dynamic route missing auth
    if (!dynamic && !hasSession && !hasHelper && !admin) {
      push({
        ruleId: 'IDOR005',
        severity: isMutating ? 'Medium' : 'Low',
        file: rel,
        handlerName: h.name,
        line: h.startLine,
        message: `${isMutating ? 'Mutating' : 'Read'} route handler ${h.name} has no session check.`,
        snippet,
      });
    }

    // Extract prisma calls once for IDOR003/004/007
    const prismaCalls = extractPrismaCalls(body);

    // Admin routes with a proper admin gate are exempt from per-row scoping
    // rules — admins legitimately access any row.
    const adminGated = admin && hasAdminCheck;

    for (const call of prismaCalls) {
      const callLineAbs = h.startLine + call.callLine - 1;
      const unscopedId = whereIsIdOnly(call.whereText, selfAliases);

      // IDOR003: dynamic-param route + auth present + unscoped single-row query
      if (
        dynamic &&
        !adminGated &&
        (hasSession || hasHelper) &&
        !hasOwnerScope && // helper or post-fetch owner check is sufficient scoping
        unscopedId &&
        ['findUnique', 'findFirst', 'update', 'delete', 'upsert'].includes(
          call.method
        )
      ) {
        push({
          ruleId: 'IDOR003',
          severity: 'High',
          file: rel,
          handlerName: h.name,
          line: callLineAbs,
          message: `prisma.${call.model}.${call.method} uses where: { id } with no ownership constraint.`,
          snippet: call.whereText.slice(0, 200),
        });
      }

      // IDOR004: mutation unscoped where regardless of route shape
      if (
        ['update', 'delete', 'upsert', 'updateMany', 'deleteMany'].includes(
          call.method
        ) &&
        unscopedId &&
        !hasOwnerScope &&
        !adminGated
      ) {
        push({
          ruleId: 'IDOR004',
          severity: 'High',
          file: rel,
          handlerName: h.name,
          line: callLineAbs,
          message: `Mutation prisma.${call.model}.${call.method} uses where: { id } with no ownership constraint.`,
          snippet: call.whereText.slice(0, 200),
        });
      }

      // IDOR007: params.x flows into where with no session read beforehand.
      // We check for any `session` reference (id, role, etc.) because even a
      // role-only read indicates the handler is consulting session context.
      if (
        /params\.\w+/.test(call.whereText) &&
        !/\bsession\b/.test(body.slice(0, call.callLine * 80)) &&
        !hasOwnerScope &&
        !adminGated
      ) {
        push({
          ruleId: 'IDOR007',
          severity: 'High',
          file: rel,
          handlerName: h.name,
          line: callLineAbs,
          message: `where clause consumes params.* but session.user.id was not read before the query.`,
          snippet: call.whereText.slice(0, 200),
        });
      }
    }

    // IDOR006: raw SQL informational
    if (RAW_SQL.test(body)) {
      push({
        ruleId: 'IDOR006',
        severity: 'Medium',
        file: rel,
        handlerName: h.name,
        line: h.startLine,
        message: `Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.`,
        snippet,
      });
    }
  }

  return findings;
}

function firstNonEmptyLines(body: string, n: number): string {
  const lines = body.split('\n').map((l) => l.trim()).filter((l) => l.length);
  return lines.slice(0, n).join('\n');
}

// --------------------------------------------------------------------------
// Report rendering
// --------------------------------------------------------------------------

function renderMarkdown(
  findings: Finding[],
  scannedFiles: number,
  root: string
): string {
  const bySev: Record<Severity, Finding[]> = {
    Critical: [],
    High: [],
    Medium: [],
    Low: [],
  };
  for (const f of findings) bySev[f.severity].push(f);
  for (const sev of Object.keys(bySev) as Severity[]) {
    bySev[sev].sort(
      (a, b) =>
        a.file.localeCompare(b.file) ||
        a.ruleId.localeCompare(b.ruleId) ||
        a.line - b.line
    );
  }

  const countByRule: Record<string, number> = {};
  for (const f of findings) {
    countByRule[f.ruleId] = (countByRule[f.ruleId] ?? 0) + 1;
  }

  const lines: string[] = [];
  lines.push('# IDOR / Authorization-Gap Scan Report');
  lines.push('');
  lines.push(`_Generated: ${new Date().toISOString()}_`);
  lines.push(`_Scanned root: \`${root}\`_`);
  lines.push(`_Files scanned: ${scannedFiles}_`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|---|---|');
  for (const sev of ['Critical', 'High', 'Medium', 'Low'] as Severity[]) {
    lines.push(`| ${sev} | ${bySev[sev].length} |`);
  }
  lines.push('');
  lines.push('### By rule');
  lines.push('');
  lines.push('| Rule | Count |');
  lines.push('|---|---|');
  for (const rule of Object.keys(countByRule).sort()) {
    lines.push(`| ${rule} | ${countByRule[rule]} |`);
  }
  lines.push('');

  for (const sev of ['Critical', 'High', 'Medium', 'Low'] as Severity[]) {
    const group = bySev[sev];
    if (!group.length) continue;
    lines.push(`## ${sev} (${group.length})`);
    lines.push('');
    for (const f of group) {
      lines.push(`### \`${f.file}\`:${f.line} — ${f.ruleId} [${f.handlerName}]`);
      lines.push('');
      lines.push(f.message);
      lines.push('');
      lines.push('```ts');
      lines.push(f.snippet);
      lines.push('```');
      lines.push('');
    }
  }

  if (!findings.length) {
    lines.push('_No findings. All scanned handlers passed the current rules._');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    'This scanner is a high-recall heuristic linter. Add `// @idor-allow: <token> reason="..."` to the top of a route file to suppress false positives. See `scripts/security/idor-scan.ts` for the full rule catalog.'
  );
  lines.push('');

  return lines.join('\n');
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const scanRoot = path.resolve(repoRoot, args.root);
  if (!fs.existsSync(scanRoot)) {
    console.error(`idor-scan: scan root does not exist: ${scanRoot}`);
    process.exit(2);
  }
  const files = walkRoutes(scanRoot);
  const all: Finding[] = [];
  for (const f of files) {
    try {
      all.push(...scanFile(f, repoRoot));
    } catch (e) {
      console.error(`idor-scan: error scanning ${f}: ${(e as Error).message}`);
    }
  }

  const reportPath = path.resolve(repoRoot, args.out);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, renderMarkdown(all, files.length, args.root));

  const counts: Record<Severity, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };
  for (const f of all) counts[f.severity]++;

  console.log(
    `idor-scan: scanned ${files.length} files, ${all.length} findings ` +
      `(Critical=${counts.Critical} High=${counts.High} Medium=${counts.Medium} Low=${counts.Low})`
  );
  console.log(`idor-scan: report written to ${path.relative(repoRoot, reportPath)}`);

  if (args.ci && counts.Critical > 0) {
    console.error(
      `idor-scan: --ci mode — ${counts.Critical} Critical finding(s), failing.`
    );
    process.exit(1);
  }
  process.exit(0);
}

main();
