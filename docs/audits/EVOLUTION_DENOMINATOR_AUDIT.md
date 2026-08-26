# EVOLUTION SIGNAL DENOMINATOR — read-only audit

Taken at `caf461a0` on `claude/title-regen-editor-layer-bv6ezt`. No code changed.

Reproduce: `npm run report:digest-churn`.

## What prompted this

Adding `steel` and `terrazzo` to `MATERIAL_CLASSES` in B5 removed
`evo:finish:brass:rising` from the probe corpus. Brass was untouched. `familyShares`
(`signals.ts:507-522`) counts only tags whose family is non-null, so the denominator
grew, brass fell from 40% to 27%, and its delta fell from +0.20 to +0.07 — under
`EVOLUTION_MIN_DELTA = 0.15` (`signals.ts:492`).

**The concern is confirmed, and it is not confined to Evolution.** Two of the six
signal computations have a vocabulary-dependent normalizer, and a third has a
vocabulary-dependent gate. The Evolution case is the most sensitive but not the most
severe.

---

## Summary

| # | finding |
|---|---|
| F1 | **Three of six computations move with vocabulary size**, not two. Corrections to B4 in §1. |
| F2 | **B4's "Singular" is not a separate consumer.** It is a second block inside `computeOutlierSignals` (`signals.ts:413-445`), emitting `outlier:finish:*`. |
| F3 | **Claim-evidence has a conditional dependence B4 recorded as "none".** It is real whenever a new term is added to a `families[]` array — which is exactly what B5 did with `terrazzo`. |
| F4 | **The B5 churn measurement never exercised claim-evidence.** The probe has no bio; `fixtureA` has a bio but no terrazzo product. The "unaffected" reading was untested, not verified. |
| F5 | **Evolution is far more sensitive than the B5 case suggested.** Under asymmetric dilution, **one** added term capturing one tag per recent project kills a +0.20 delta. |
| F6 | **Outlier/project is more severe than Evolution.** Three shared classes drop a *maximum-distance* outlier (1.00) below the 0.60 threshold. |
| F7 | **Outlier/finish moves in the opposite direction** — it *creates* signals about unrelated families by flipping a global gate. |
| F8 | **The blast radius extends past computation into persisted rows.** `validateAngles` checks citations at write time only; `toExtractedAngle` re-reads them with no re-validation. A vocabulary change can orphan already-persisted angle evidence, silently. |
| F9 | **B5 is the first and only growth event.** The vocabulary sat at 38 terms from introduction (2026-07-14) to B5 (2026-08-25). |
| F10 | **A fix for Evolution does not address either Outlier path.** Different mechanisms, different repairs. |

---

## 1. Blast radius

Six computations, not five (`SIGNAL_COMPUTATIONS`, `signals.ts:557`). Four read
`finishFamily`.

| computation | reads `finishFamily`? | normalizer / gate | moves with vocabulary? |
|---|---|---|---|
| `computeRepetitionSignals` (`:61`) | yes (`:84`) | `projectIds.size / projectCount` (`:112`, `:129`); gate `>= 2` projects (`:88`, `:123`) | **No** |
| `computeDistributionSignals` (`:149`) | no | shares of room type / category | **No** |
| `computeClaimEvidenceSignals` (`:307`) | yes (`:323`) | absolute counts — `CLAIM_MATCH_MIN_ROWS = 3`, `CLAIM_MATCH_MIN_PROJECTS = 2` (`:304-305`) | **Conditional** |
| `computeOutlierSignals` — project (`:364`) | yes (`:377`) | Jaccard over trait sets; `PROJECT_OUTLIER_MIN_DISTANCE = 0.6` (`:362`) | **Yes** |
| `computeOutlierSignals` — finish (`:413`) | yes (`:416`) | global `repeatedFamilies >= 2` (`:423-426`) | **Yes** |
| `computeSaveDeltaSignals` (`:458`) | no | save counts vs baseline | **No** |
| `computeEvolutionSignals` (`:494`) | yes (`:512`) | `familyShares` — `total` = tags with non-null family (`:509`); `EVOLUTION_MIN_DELTA = 0.15` | **Yes** |

### Corrections to B4

B4 named "Outlier, Singular and Evolution". Substantively right, with three fixes:

1. **"Singular" is not a separate consumer** (F2). Both blocks live in
   `computeOutlierSignals` and share its `raw.projects.length < 3` guard, but they
   have *different* mechanisms and move in *opposite* directions. Treating them as
   one consumer hides that.
2. **Claim-evidence is not immune** (F3). B4 recorded "none — neither `steel` nor
   `terrazzo` appears in any `families` array." That was true when written and false
   by the end of B5, which added `terrazzo` to the stone entry (`signals.ts:287`).
   The dependence is conditional, not absent: it fires whenever a new term joins a
   `families[]` array, or when a term *shadows* an existing one under first-hit-wins
   (the `white oak` case B5 rejected).
3. **Repetition's immunity is structural, worth stating.** Its denominator is
   `projectCount` — a property of the designer's work. That is the shape the other
   three lack.

### Mechanisms

**Evolution — a denominator that counts coverage, not work.**
```
total = tags whose family resolves        (signals.ts:509-515)
share = family count / total
fires when |late.share - early.share| >= 0.15
```
Vocabulary growth converts tags from unresolvable to resolvable, so `total` rises
while an untouched family's count does not. Every other family's share falls.

**Outlier/project — a distance that shrinks as trait sets grow.**
Traits are `room:*` + `finish:*` (`:374-378`). Jaccard distance is
`1 - |A∩B| / |A∪B|`. A class that resolves across *all* projects adds 1 to both the
intersection and the union of every pair, which strictly *reduces* distance. Broad
new coverage therefore makes every project look more alike.

**Outlier/finish — a global gate.**
`repeatedFamilies >= 2` (`:423-426`) is computed across the whole corpus and gates
signals for *every* family. One new class repeating across two projects can flip it,
emitting singular signals about families that have nothing to do with the addition.

**Claim-evidence — membership, not normalization.**
`familyHit` is set-membership in `entry.families` (`:323`). Thresholds are absolute
counts, so there is no dilution. It moves only when the family *mapping* changes.

---

## 2. Sensitivity

Measured against the real `computeEvolutionSignals`, not derived. Baseline family:
brass at 20% early / 40% late, delta +0.20, threshold 0.15.

**The unit that matters is not "number of terms". It is the share of classified tags
newly captured.** A term matching nothing costs nothing; a term matching a material
the designer uses constantly is worth many terms.

### Asymmetric dilution — new material enters only the recent half

```
new tags per late project | late classified | brass late share | delta  | signal
                        0 |              20 |            0.400 | +0.200 | alive
                        1 |              24 |            0.333 | +0.133 | GONE
                        2 |              28 |            0.286 | +0.086 | GONE
                        4 |              36 |            0.222 | +0.022 | GONE
                        6 |              44 |            0.182 | -0.018 | GONE
```

**One tag per recent project — a 20% growth in late-half classified tags — is
enough.** In practical terms: **a single added term can do it**, if that term
resolves for roughly one tag per recent project.

### Symmetric dilution — new material spread evenly across both halves

```
new tags per project | growth in classified tags | delta  | signal
                   0 |                        0% | +0.200 | alive
                   2 |                       20% | +0.167 | alive
                   3 |                       30% | +0.154 | alive
                   4 |                       40% | +0.143 | GONE
```

**Roughly a third of growth.** About **4 terms** at one tag per project each.

### Closed form

Let `C` = classified tags in the diluted half, `k` = newly classified tags there,
`δ` = the family's delta, `θ = 0.15`, and `e`/`l` its early/late shares.

- **Symmetric** — both shares scale by `f = C/(C+k)`, so `δ' = f·δ`. Survives while
  `k ≤ C·(δ/θ − 1)`. At `δ = 0.20`: **`k ≤ C/3`**.
- **Asymmetric (late only)** — `δ' = f·l − e`. Survives while
  `k ≤ C·(l/(θ+e) − 1)`. At `l = 0.40, e = 0.20`: **`k ≤ 0.143·C`**.

Both match the sweeps exactly. Asymmetric: `C = 20`, bound `k ≤ 2.86` total new
tags; one per late project is 4 across the four late projects, over the bound — and
that is the first `GONE` row. Symmetric: `C = 10` per project, bound `k ≤ 3.33`; the
sweep is alive at 3 and gone at 4.

### The uncomfortable implication

Asymmetric dilution is ~2.3× more sensitive than symmetric, **and asymmetric is the
realistic case.** A term gets added because a material started appearing — which
means its tags concentrate in the recent half. So the vocabulary grows in exactly the
pattern that maximally suppresses *other* rising families.

The signal most likely to be destroyed is a genuine rising trend, destroyed by
admitting a different genuine rising trend.

---

## 3. History

**The vocabulary has grown exactly once.** Traced across every commit touching
`signals.ts`:

| commit | date | constant | terms |
|---|---|---|---|
| `cd40426b` | 2026-07-14 | `FINISH_FAMILIES` | 38 |
| `ea01158d` · `279a9c15` · `d5e1d517` · `75aef33f` · `762a5170` | 2026-07-14 → 07-22 | `FINISH_FAMILIES` | 38 |
| `506bcab8` | 2026-08-25 | renamed `MATERIAL_CLASSES` | 38 |
| `caf461a0` | 2026-08-25 | `MATERIAL_CLASSES` | **40** |

Introduced at 38 and unchanged for six weeks. **B5 is the first growth event**, so
there is no prior incident to learn from — and equally, no accumulated drift.

### Did live signals move?

**Cannot be determined here.** No `DATABASE_URL` in this environment. It is
determinable with one, and the query is not obvious, so it is worth writing down.

Signals are **not persisted** — `buildCorpusDigest` computes fresh, with no cache. So
there is no historical signal table to diff. What *is* persisted is
`DesignerAngle.signalIds` and `DesignerAngle.evidence`, written at extraction time.

The check for whether B5 moved anything live:

```
1. Read every DesignerAngle created before caf461a0 was deployed.
2. Recompute the digest for each designer at the current vocabulary.
3. Any persisted signalId absent from the recomputed set is an angle whose
   cited evidence no longer exists.
```

`evo:finish:*` and `outlier:*` ids are where losses would appear. `rep:*` ids cannot
be lost by an addition.

### F8 — the durable consequence

This is the part that outlives the signal computation.

`validateAngles.ts:93` rejects an angle citing any id not in the digest — the guard
against fabricated citations. It runs **only on the way in**. `toExtractedAngle`
(`index.ts:87-102`) reads persisted rows straight back, and its own comment says so:
*"angleType was validated on the way in."* Nothing re-checks `signalIds` on read.

So an angle persisted before a vocabulary change can cite a signal that no longer
computes, and it will keep being served — with `evidence` frozen from write time —
looking exactly like a valid angle. The guard that exists to stop unsupported angles
does not fire, because it already fired, before the support disappeared.

**This is the same shape as a bug this repo already fixed once.** Stored headline
alternatives outlived the rules that produced them until `buildRoomTiles` began
re-grading the stored pool on read (docs/23, "Bugs already fixed"). The remedy there
was to re-grade on read rather than trust write time. The equivalent question here is
whether `signalIds` should be re-validated on read — and it is a question about
*any* digest change, not only vocabulary.

---

## 4. Options

Set out with trade-offs. **None is recommended; none is decided.**

Two of these address the reported symptom, one is a no-op as literally stated, one is
orthogonal to it, and two came out of the audit.

### A. Fixed denominator — divide by *all* tags, not classified ones

`total` counts every tag in the half, whether or not its family resolves.

- **Removes cross-family contamination entirely.** A family's share stops depending
  on whether *other* materials are in the vocabulary. One-line change at `:509-515`.
- Shares no longer sum to 1 across families; they become "share of all specs".
- **Depresses every share in poorly-tagged corpora**, so `0.15` becomes much harder
  to clear — and hardest exactly where tagging is thin. The threshold would need
  re-derivation, and the signal would get rarer overall.
- Does **not** remove vocabulary dependence from a family's own numerator: brass
  still only counts if `brass` is in the vocabulary. It removes the contamination,
  not the coupling.

### B. Absolute counts rather than shares

Compare tag counts per half directly.

- Immune to any denominator; no contamination possible.
- **Not normalized for corpus growth.** A designer who simply published more recently
  shows *every* family rising. Fixing that needs a denominator again — though
  normalizing by *projects per half* is vocabulary-independent, unlike today's.
- `EVOLUTION_MIN_DELTA = 0.15` is a share and does not transfer; a count threshold
  needs its own derivation, and probably scales with corpus size.

### C. Denominator counting only families present in that designer's corpus

**As literally stated this is what the code already does.** `total` counts tags whose
family is non-null — that is, tags belonging to families the designer uses. It is a
no-op, and the reason is the crux of the whole issue: *"present in the corpus" is
itself vocabulary-dependent.* The designer's steel tags were always present; they
were merely unresolvable.

There is a nearby variant that is not a no-op: **freeze the family set** (e.g. to the
families seen in the early half) and hold the denominator to it.

- Removes contamination from terms added later.
- **Understates a genuinely new material.** A material that only appears in recent
  work is excluded from the denominator it should be growing within — which is the
  opposite error, and arguably worse, since a new material is the most newsworthy
  case.

### D. Vocabulary-version stamping

Stamp the vocabulary version on computed signals and persisted angles; refuse to
compare across versions.

- **Does not address the reported symptom.** B5's churn happened inside a *single*
  run, where both halves were computed under the same vocabulary. Stamping changes
  nothing about the brass result.
- It *does* address F8 — a persisted angle citing a signal from an older vocabulary
  becomes detectable rather than silent. That is a real problem, but a different one.
- Cost is a schema field on `DesignerAngle` and a decision about what to do when
  versions disagree (suppress, recompute, flag).

### E. Ratio instead of difference *(not in the brief)*

Fire on `late.share / early.share >= R` rather than `late − early >= θ`.

- **Exactly immune to symmetric dilution** — a common factor cancels. Removes the
  larger of the two families of error at a stroke.
- Still bites under asymmetric dilution, though less: the ratio scales by `f` rather
  than the delta shifting by `f·l`.
- Ill-behaved when `early.share` is near zero — precisely the new-material case,
  where the ratio explodes. Needs a floor or a smoothing constant, which is another
  tuned number.

### F. Re-validate `signalIds` on read *(not in the brief)*

Recompute the digest when serving a persisted angle and drop citations that no longer
resolve.

- Directly fixes F8, and fixes it for *every* cause of digest drift, not just
  vocabulary — new projects, deleted tags, threshold changes.
- Mirrors the remedy already adopted for stored headline alternatives, so it is a
  pattern this codebase has already argued through.
- Costs a digest recomputation on read, which is the expensive path. Also forces a
  policy decision: is an angle that loses one of three citations still valid?

### Cross-cutting note

A, B, C-variant and E are alternatives to each other — all reshape the Evolution
comparison. D and F address F8 and are **compatible with any of them**. Choosing one
from each group is coherent; they are not competing.

---

## 5. Outlier and Singular

### Do they have the same dependence?

Both move with vocabulary, **neither for the Evolution reason.**

**Outlier/project — yes, and more severely.** Measured, adding classes that resolve
across every project:

```
shared classes added | outlier fires | distance
                   0 |           yes |     1.00
                   1 |           yes |     0.80
                   2 |           yes |     0.67
                   3 |            NO |        -
```

**Three shared additions extinguish a maximum-distance outlier.** A project at
distance 1.00 shares *nothing* with the rest of the corpus — the strongest form the
signal takes — and three broadly-used new classes drop it under 0.60.

The mechanism is not a denominator. With disjoint trait sets of size `n` and `k`
shared traits added, distance is `1 − k/(2n+k)`. Trait sets are small (a room type
and a finish or two), so each added shared trait is a large fraction of the set. The
signal is fragile because the sets are small, and vocabulary growth is one way — not
the only way — to grow them.

**Outlier/finish — yes, in the opposite direction.** It *gains* signals:

```
new repeated classes | repeatedFamilies | velvet singular fires
                   0 |                1 | NO
                   1 |                2 | yes
                   2 |                3 | yes
```

Velvet is untouched throughout. Its singular signal appears because one new class
repeated across two projects pushed `repeatedFamilies` from 1 to 2, opening a gate
that suppresses *all* singular signals below it. An addition therefore emits a claim
about a family it has nothing to do with.

This is not dilution and not a denominator — it is a **global gate on a local claim**.
It is monotone for non-shadowing additions (signals can only appear), which makes it
the least harmful of the three; but "least harmful" still means the corpus asserts
something new about velvet because of steel.

### Would a fix for Evolution address them?

**No — for either, under any option in §4.**

| | mechanism | addressed by A / B / C-variant / E? |
|---|---|---|
| Evolution | share denominator counting resolvable tags | yes — that is what those options reshape |
| Outlier/project | Jaccard over small trait sets; absolute distance threshold | **no** — there is no share to renormalize |
| Outlier/finish | global `repeatedFamilies >= 2` count gate | **no** — there is no share to renormalize |

They need their own treatments, and the shapes differ:

- **Outlier/project** — candidates include normalizing distance by trait-set size,
  weighting `finish:` traits against `room:` traits, or making the threshold a
  function of corpus trait cardinality rather than the constant `0.6`. All change
  what "breaks the pattern" means, so all are editorial decisions as much as
  numerical ones.
- **Outlier/finish** — candidates include making the gate proportional
  (`repeatedFamilies >= half the families in use`), or dropping the global gate for a
  local test on the family itself. The gate exists to avoid calling a family singular
  in a corpus with no established repetition; a proportional form keeps that intent
  without the cliff.

D and F apply unchanged to all three, since both are about persisted citations rather
than about how any one signal is computed.

---

## Appendix — reproduction

```
npm run report:digest-churn      # the B5 finding, both fixtures plus the probe
```

The sensitivity and Outlier sweeps in §2 and §5 were run against
`computeEvolutionSignals` and `computeOutlierSignals` directly, over synthetic
corpora built with `scripts/fixtures/digestCorpus.ts`. They were run from a scratch
directory and are not committed — this audit changed no code. The corpora are
described in full above and are a few lines to rebuild.

Line references are to `src/lib/editorial-queue/signals.ts` at `caf461a0` unless
otherwise stated.
