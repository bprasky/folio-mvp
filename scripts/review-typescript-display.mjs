// Review-only proof. Does not change the diagnostic budget or active schema.
import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeMessage } from './check-typescript-budget.mjs';

// Only unordered, uniquely named property signatures may be sorted. Overloads,
// methods, index signatures, union members and parameter order are preserved.
export function canonicalTypeDisplay(text) {
  const source = ts.createSourceFile('display.ts', `type Display = ${text};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (source.parseDiagnostics.length || source.statements.length !== 1 || !ts.isTypeAliasDeclaration(source.statements[0])) return text;
  const transformed = ts.transform(source, [context => root => {
    const visit = node => {
      node = ts.visitEachChild(node, visit, context);
      if (!ts.isTypeLiteralNode(node) || !node.members.every(m => ts.isPropertySignature(m) && m.name && !ts.isComputedPropertyName(m.name))) return node;
      const named = node.members.map(member => ({ member, name: member.name.getText(source) }));
      if (new Set(named.map(x => x.name)).size !== named.length) return node;
      named.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      return ts.factory.updateTypeLiteralNode(node, named.map(x => x.member));
    };
    return ts.visitNode(root, visit);
  }]);
  try {
    return ts.createPrinter({ removeComments: false }).printNode(ts.EmitHint.Unspecified, transformed.transformed[0].statements[0].type, source).replace(/\s+/g, ' ').trim();
  } finally { transformed.dispose(); }
}

export function canonicalDiagnosticDisplay(message) {
  return message.replace(/'([^']*)'/g, (whole, type) => type.includes('{') ? `'${canonicalTypeDisplay(type)}'` : whole);
}

function snapshot(output) {
  const root = process.cwd();
  const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error('Could not read TypeScript config');
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, { noEmit: true, incremental: false, noErrorTruncation: true });
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const messages = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error).map(d => {
    const message = normalizeMessage(ts.flattenDiagnosticMessageText(d.messageText, '\n'), root);
    return {
      file: d.file ? relative(root, d.file.fileName).replaceAll('\\', '/') : '<global>',
      start: d.start, length: d.length, code: d.code,
      sourceSha256: d.file ? createHash('sha256').update(d.file.text).digest('hex') : null,
      message, canonical: canonicalDiagnosticDisplay(message),
    };
  });
  writeFileSync(output, JSON.stringify({ compiler: ts.version, noErrorTruncation: true, total: messages.length, messages }, null, 2) + '\n');
  console.log(`Captured ${messages.length} full diagnostics: ${output}`);
}

function compareFiles(beforePath, afterPath, output) {
  const before = JSON.parse(readFileSync(beforePath)), after = JSON.parse(readFileSync(afterPath));
  const identity = x => JSON.stringify([x.file, x.start, x.length, x.code, x.sourceSha256]);
  const old = new Map();
  for (const row of before.messages) old.set(identity(row), [...(old.get(identity(row)) || []), row]);
  const rows = after.messages.map(x => {
    const candidates = old.get(identity(x)) || [];
    let index = candidates.findIndex(b => b.message === x.message);
    if (index < 0) index = candidates.findIndex(b => b.canonical === x.canonical);
    if (index < 0 && candidates.length === 1) index = 0;
    const b = index < 0 ? undefined : candidates.splice(index, 1)[0];
    return { file: x.file, start: x.start, length: x.length, code: x.code, sourceSha256: x.sourceSha256,
      matchedOccurrence: !!b, sameFullText: b?.message === x.message,
      sameCanonicalTypeDisplay: b?.canonical === x.canonical,
      ...(b?.message !== x.message ? { before: b?.message, after: x.message, canonicalBefore: b?.canonical, canonicalAfter: x.canonical } : {}),
    };
  });
  const result = { beforeTotal: before.total, afterTotal: after.total, compiler: before.compiler,
    sameCompiler: before.compiler === after.compiler,
    exactOccurrenceMatches: rows.filter(x => x.matchedOccurrence).length,
    unmatchedBaselineOccurrences: [...old.values()].reduce((sum, rows) => sum + rows.length, 0),
    changedFullText: rows.filter(x => !x.sameFullText).length,
    canonicalMismatches: rows.filter(x => !x.sameCanonicalTypeDisplay),
    changed: rows.filter(x => !x.sameFullText),
  };
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, changed: result.changed.length, canonicalMismatches: result.canonicalMismatches.length }));
}

function witnesses(proofPath, output) {
  const root = process.cwd();
  const proof = JSON.parse(readFileSync(proofPath));
  const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, { noEmit:true,incremental:false,noErrorTruncation:true });
  const program = ts.createProgram({ rootNames:parsed.fileNames,options:parsed.options });
  const checker = program.getTypeChecker();
  const rows = proof.canonicalMismatches.map(location => {
    const source = program.getSourceFile(resolve(root,location.file));
    let assignment;
    const visit = node => {
      if (ts.isPropertyAssignment(node) && node.name.getStart(source) === location.start) assignment=node;
      ts.forEachChild(node,visit);
    };
    visit(source);
    if (!assignment) throw new Error('Expected the same object-literal assignment');
    const expression=assignment.initializer;
    const actual=checker.getTypeAtLocation(expression), expected=checker.getContextualType(expression);
    if (!expected) throw new Error('Expected contextual target type');
    const display=type=>canonicalTypeDisplay(checker.typeToString(type,expression,ts.TypeFormatFlags.NoTruncation));
    const variants=(expected.isUnion() ? expected.types : [expected]).map(target=>({
      target:display(target), assignable:checker.isTypeAssignableTo(actual,target),
      properties:checker.getPropertiesOfType(actual).map(property=>{
        const wanted=checker.getPropertyOfType(target,property.name);
        const sourceType=checker.getTypeOfSymbolAtLocation(property,expression);
        const targetType=wanted ? checker.getTypeOfSymbolAtLocation(wanted,expression) : undefined;
        return {name:property.name,source:display(sourceType),target:targetType ? display(targetType) : '<absent>',assignable:targetType ? checker.isTypeAssignableTo(sourceType,targetType) : false};
      }).sort((a,b)=>a.name.localeCompare(b.name)),
      missingRequired:checker.getPropertiesOfType(target).filter(p=>!(p.flags & ts.SymbolFlags.Optional) && !checker.getPropertyOfType(actual,p.name)).map(p=>p.name).sort(),
    })).sort((a,b)=>a.target.localeCompare(b.target));
    return {file:location.file,start:location.start,length:location.length,sourceSha256:createHash('sha256').update(source.text).digest('hex'),sourceType:display(actual),variants};
  });
  writeFileSync(output,JSON.stringify(rows,null,2)+'\n');
  console.log(`Captured ${rows.length} complete assignment/property witnesses`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'snapshot' && args.length === 1) snapshot(args[0]);
  else if (mode === 'compare' && args.length === 3) compareFiles(...args);
  else if (mode === 'witnesses' && args.length === 2) witnesses(...args);
  else throw new Error('Usage: review-typescript-display.mjs snapshot OUTPUT | compare BEFORE AFTER OUTPUT | witnesses PROOF OUTPUT');
}
