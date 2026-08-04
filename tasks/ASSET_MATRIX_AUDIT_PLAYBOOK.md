# Asset Matrix Audit Playbook

Sequenced Claude Code prompts establishing what the record supports before any composer
work begins. Every phase cites `docs/21_ASSET_MATRIX.md`.

**Rules applying to every phase:**
- **Read-only until Phase E.** Phases A through D change nothing. They produce reports.
- **Ground every finding in file:line or schema model:field.** A field that "probably
  exists" is UNVERIFIED.
- **Report absence explicitly.** A field that does not exist is the most valuable finding
  in this audit. Do not infer it from adjacent fields.
- **One phase at a time.** Phase A gates everything.

Phase A is the load-bearing one. The composer cannot be scoped until it returns.

---

## PHASE A. Field dependency audit (READ-ONLY, gates everything)

```
Read-only audit. Produce docs/audits/ASSET_MATRIX_FIELD_AUDIT.md. Change nothing.

Read docs/21_ASSET_MATRIX.md first. Section 11 contains a table of fields with every
status marked UNVERIFIED. Your job is to resolve each one to PRESENT, PARTIAL, or ABSENT
with a schema or file:line citation.

For each row in that table:
1. Locate the field in prisma/schema.prisma or establish that it does not exist.
2. If present, report the exact model, field name, and type, and whether it is nullable.
3. If nullable, report actual population rate against existing rows if a query is
   available, or state that population is unknown.
4. If the dependency is a relation chain rather than a single field (quote to answer to
   transcript segment to audio offset), trace every hop and report the weakest link.
5. Mark PARTIAL where a field exists but stores free text where the block requires a
   structured value. Product finish is the specific case to watch: a String finish field
   satisfies display but does not satisfy Material Palette or Material Study, which need
   to group identical finishes across products and projects.

Then answer these five questions directly, since they determine Phase 1 scope:

Q1. Is per-question interview audio persisted to storage after transcription, or is it
    discarded? If persisted, where, in what format, and is it addressable from the answer
    record? This single answer determines whether Teaser Film is buildable at all.
Q2. Given a published pull quote, can the system resolve backward to the interview answer
    it came from, and from there to a transcript segment with word-level timestamps? Report
    every model in that chain and every hop that is missing.
Q3. Does every ProjectImage carry a room reference, and does every Room carry a designated
    hero image? If hero designation does not exist, report how a room's primary image is
    currently selected anywhere in the codebase.
Q4. Can the same Product be resolved across two different projects, and can the same finish
    be resolved across two different products? Report the join path or its absence.
Q5. Does ImageSource or any equivalent provenance enum exist on images? Report its values
    and whether it is required.

Output the Section 11 table with resolved statuses, then a ranked list of every ABSENT or
PARTIAL field ordered by how many blocks in Section 3 it blocks. Stop at the report. Make
no schema changes and propose no migrations in this phase.
```

---

## PHASE B. Existing generator inventory (READ-ONLY)

```
Read-only audit. Produce docs/audits/ASSET_GENERATOR_INVENTORY.md. Change nothing.

docs/21_ASSET_MATRIX.md Section 3 defines a block library and Section 6 defines four render
targets. Some of this is partially built already under other names. Find all of it before
anything new is written.

1. INVENTORY every existing code path that produces a visual or document output from
   project data. Include at minimum: the Instagram carousel and single slide generators,
   the social deployment channel, any PDF or spec sheet export, any moodboard export, and
   any ProjectModule render path. Report file:line and current build state, being built,
   stubbed, or dead.
2. MAP each one onto the Section 1 matrix. State which cell it occupies and at which scope.
   Where a generator spans multiple cells in one code path, say so, since that is the
   fragmentation this document exists to prevent.
3. IDENTIFY duplicated layout logic. Report every place that independently declares type
   scale, spacing, color tokens, or frame treatment rather than importing from the design
   system. Section 2 requires one invariant frame, so every independent declaration is a
   drift site.
4. CROSS-REFERENCE the pending Instagram export audit from the interview playbook Phase 7
   if it has been run. If it has not, note that it should run before or alongside this.
5. RECOMMEND, without code, what collapses into what: which existing generators become
   consumers of the block library, which are replaced, and which are unrelated and stay.

Ground every claim in file:line. Stop at the report.
```

---

## PHASE C. Design token and frame audit (READ-ONLY)

```
Read-only audit. Produce docs/audits/ASSET_FRAME_AUDIT.md. Change nothing.

docs/21_ASSET_MATRIX.md Section 2 requires that the frame be invariant across every
designer and every block, and carry near-zero visual weight so photography reads first.

1. INVENTORY the canonical design tokens as they exist in code: color, type scale, spacing,
   the glass classes, the mesh treatment. Report where they are defined and whether there is
   one definition or several.
2. VERIFY the photography rule. Report every place in the codebase where any treatment,
   overlay, gradient, mesh, or glass surface is composited over a project photograph. Per
   02, glass and mesh are white-background UI chrome only. Any instance over photography is
   a violation and should be reported with file:line, whether or not it is on an export path.
3. ASSESS render parity. The four targets in Section 6 are 11 x 8.5in, 4:5, 9:16, and 1:1.
   Report whether the current token system expresses type scale in units that survive
   re-rendering at these sizes, or whether sizes are hardcoded per surface.
4. RECOMMEND, without code, the minimum token work required before one block can render
   correctly at all four targets.

Stop at the report.
```

---

## PHASE D. Corpus resolvability probe (READ-ONLY)

```
Read-only audit. Produce docs/audits/CORPUS_RESOLVABILITY.md. Change nothing.

docs/21_ASSET_MATRIX.md Section 7 defers corpus scope, and Sections 8 and 9 depend entirely
on cross-project resolution. This phase establishes whether corpus scope is a deferred build
or a blocked one.

Answer with queries against the current schema, reporting actual counts where data exists:

1. Can the system count how many distinct projects a given product has been tagged in?
   Report the query and whether an index supports it.
2. Can the system count how many distinct projects a given finish appears in? If finish is
   free text, report the distinct-value count on existing rows, since that number determines
   whether normalization is a cleanup or a rebuild.
3. Can the system identify the first designer to tag a given product, from timestamps
   currently stored? Report whether that is durable or derived from a mutable field.
4. Can the system identify products specified by a given designer across all their projects,
   scoped to what a vendor is permitted to see under 16_ATTRIBUTION_CONSENT tiers? Report the
   consent check that would need to sit on that query and whether it exists today.
5. Report elapsed-time availability: for any quote or install image, can the system resolve
   how long ago the project completed, as distinct from when the record was created?

Stop at the report. Propose no migrations.
```

---

## PHASE E. Migration proposal (WRITES A PROPOSAL, NOT A MIGRATION)

```
Do not apply anything. Produce docs/proposals/ASSET_MATRIX_MIGRATIONS.md.

Using the ABSENT and PARTIAL findings from Phase A and Phase D, propose the minimum set of
ADD-only schema changes required to make Phase 1 project-scope blocks buildable. Corpus-scope
fields are proposed separately and marked deferred.

Constraints:
- ADD-only. No column drops, no type narrowing, no required columns on existing tables
  without a backfill plan stated.
- One migration per proposal entry, each independently approvable.
- Every proposed field cites the specific block in Section 3 that it unblocks. A field that
  unblocks nothing is not proposed.
- Where a field could be added now or observed first, state which and why. Follow the
  parse-first discipline: do not fix a column definition before the miss behavior has been
  observed empirically.
- Flag any proposal that would change existing generator output, since that is intended-change
  work rather than a schema addition.

Rank by how many blocks each unblocks. Stop at the proposal. Apply nothing.
```

---

## Execution order

A gates everything. B and C are independent of A and of each other and can run in parallel.
D can run any time but is only actionable after A. E requires A and D.

Do not begin composer implementation until A returns, since the eligible block set and
therefore the entire Phase 1 scope is unknown until then.

## Separate track

The audio retention question in Phase A, Q1 is the only item on this list that is time
sensitive rather than sequence sensitive. If audio is being discarded today, every interview
conducted before that changes produces a kit missing its strongest asset, and the founding
cohort would need re-interviewing to receive what they were promised for the first one.
Resolve Q1 ahead of the rest of Phase A if it can be resolved independently.
