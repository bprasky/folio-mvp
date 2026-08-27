# HEADLINE GRAIN AUDIT

Read-only survey taken at `13c84921`. Measurements are reproducible; where a number
could not be measured it says so.

## What prompted it

The first five headlines to reach a designer were all at **product grain** — a glass
table, a stone, paneling, black anchors, styling. The held-out corpus is not.

---

## Summary

| # | finding |
|---|---|
| G1 | `resolveMaterialCandidates` returns a **material class aggregated over product tags**. The unit of iteration is one product pinned to one photograph. |
| G2 | **Room identities are computed and then discarded.** `at.rooms` is a `Set` of room ids; only `.size` escapes. The resolver knows *which* rooms and exports *how many*. |
| G3 | The `object` slot **does** resolve to a room — but only for `agent-verb-object`. The Material frame, which fired for all five samples, has no object slot. |
| G4 | The Material frame's `tail` slot is **never pushed**, so it renders as a description and the model invents the place. |
| G5 | **~0% of corpus headlines put a product instance in subject position**; 41% are project/dwelling grain and 13% room grain. The five samples are 100% product-or-below. |
| G6 | Material-as-subject is real but a minority: of 19 corpus headlines naming a material, **4 subject / 10 instrument / 5 other**. |
| G7 | **76% of the corpus names no material class at all**, and the Material frame requires one. |

---

## 1. What `resolveMaterialCandidates` returns

A **material class**, not a product, tag, or room.

```ts
MaterialCandidate { value: string; tagCount: number; imageCount: number; roomCount: number }
```

The query iterates **tags** — `productTag.findMany({ where: { image: { projectId } } })`
— and derives the class from a single product's text (`name + description + category`,
plus `Selection.colorFinish`) through `materialClassOf`.

Worked example. The derivation is real; the product rows are constructed, because this
environment has no `DATABASE_URL`.

```
tag on img-1  room=Dining Room   product="Saarinen Oval Dining Table"  -> glass
tag on img-2  room=Dining Room   product="Saarinen Oval Dining Table"  -> glass
tag on img-3  room=Primary Bath  product="Calacatta Slab"              -> marble

returned:  {value:"glass",  tagCount:2, imageCount:2, roomCount:1}
           {value:"marble", tagCount:1, imageCount:1, roomCount:1}
prompt:    "- glass (specified across 2 images)"
```

So the candidate is a class whose entire evidence chain is *product → tag → count*.
Nothing downstream knows the class describes a room or a project.

### G2 — the room is known and thrown away

```ts
at.rooms.add(tag.image?.roomId ?? tag.image?.room ?? `image:${tag.imageId}`);  // :318
...
roomCount: at.rooms.size,                                                      // :327
```

The `Set` holds identities. Only its cardinality survives. Even Continuity — *"travertine
runs from the kitchen to the bath"* — has the count and not the names.

---

## 2. Can the object slot resolve to a room, or the project?

**A room, yes. The project, never.** And the frame that fired for the five samples has
no object slot at all.

| slot | resolves to | pushed? |
|---|---|---|
| `object` | `chapterTitles[0]` — a room name (`route.ts:240–242`) | ✅ |
| `material` | material class | ✅ |
| `verb` | eligible verb | ✅ |
| `agent` | credited name | ✅ |
| **`tail`** (Material frame) | — | ❌ never pushed |
| `instrument` (agent frame) | — | ❌ never pushed |
| the project itself | — | ❌ no slot exists |

`object` belongs only to `agent-verb-object`. The Material frame's slots are
`material, verb, tail`, and `tail` renders as a *description* — "what the material acts
on, and where" — so the model supplies the place. **Three of the five samples named no
location.** That is G4, and it is the direct cause.

The room data is in scope the whole time: `chapterTitles` at `route.ts:191`, injected
into the prompt as prose at `:293`, and given as a slot to exactly one frame.

---

## 3. What a room- or project-grain candidate set would contain

Not measurable against the five projects — no `DATABASE_URL`. Structurally, every input
is already loaded and discarded:

| grain | available | where | used as |
|---|---|---|---|
| room | room per class | `at.rooms`, discarded `:327` | a count |
| room | all room names | `chapterTitles` `:191` | prose; one slot |
| project | `title`, `city`, `regionState` | `route.ts` select | a `location` string |
| project | room count, tag count | derivable | unused |

Room-grain candidate: `{ room: "Primary Bath", classes: ["marble"], tagCount, imageCount }`.
Project-grain: `{ title, location, roomCount, dominantClass }`. **Both are the same
aggregation keyed differently** — no schema change, no new query.

---

## 4. Does the slot ordering assume the material is the subject?

Yes, in three places at once, which is why it is not a reordering:

- `slots: [material, verb, tail]` — position 0 is the subject
- `requiredFields: ['material']` — no material, no frame
- `shape`: *"{material} is the SUBJECT and it must ACT"*, and ranking by `roomCount`
  picks *the* material

### The corpus, measured

Of 80 unique headlines, **19 name a material class**. Within those 19:

| material position | n |
|---|---|
| subject | **4** |
| instrument (after a preposition) | **10** |
| other | 5 |

So instrument is ~2.5× more common — but material-as-subject is real, not absent:
*"Coloured marble defines his-and-hers sinks in Marylebone penthouse"*.

**Subject grain is the sharper measurement:**

| subject grain | corpus | the five samples |
|---|---|---|
| project / dwelling | **41%** | 0 |
| room / space | **13%** | 0 |
| product instance | ~0% (4 hits, 3 of them regex artifacts) | **3 of 5** |

Even the four material-subject corpus entries close on project grain — *"in Marylebone
penthouse"*, *"in Milan apartment"*, *"This 1300s French Townhouse"*. The material acts
on a room feature, **located in a project**. The five samples never leave the object.

### What would change if the material moved to instrument, room to object

Reported, not built.

1. `requiredFields: ['object']` — the frame fires on any project with a room, not only
   one with a tagged material class. Given G7, that is most of the coverage gap.
2. Ranking inverts: pick the **room**, then the class within it — instead of picking the
   class and discarding which room it came from.
3. `roomCount` stops being the sort key and becomes evidence for *which* room.
4. Application and Placement verbs read correctly with a room as object — *"clads the
   kitchen in oak"* — where today the material must be their subject.
5. `hasWeakPredicate` needs relaxing. It flags 6 of the 56 held-out headlines, and every
   one is a project- or room-subject shape. A room-subject frame legitimately admits
   *"A Midcentury Home's Past Mistakes Are Finally Corrected"*.
6. `MATERIAL_FRAME` stops being the frame that fires for everything.

---

## Reproduction

```
npm run check:headline-frames
```

The corpus measurements read `docs/audits/headline-discriminator-corpus.json`. The
subject-grain classification is a coarse noun-class regex and is reported with its own
false-positive count rather than as an exact figure.
