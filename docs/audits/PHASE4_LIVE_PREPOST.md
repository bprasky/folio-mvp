# Phase 4 — Live PRE/POST verification: BLOCKED on a usable API credential

**Status: could not run. No results were fabricated.** The live generation is fully
feasible here (no DB needed — see below); the only missing piece is a usable
`ANTHROPIC_API_KEY`, which is **not present in this environment** despite the expectation
that one was available. Reporting the blocker with evidence and leaving a ready-to-run
harness so this completes in ~2 commands once a real key is exported.

No prompt code was changed in this run.

## The blocker (evidence)
- `process.env.ANTHROPIC_API_KEY` → **unset** in the subprocess (`ANTHROPIC_API_KEY set: false`).
- No `.env` / `.env.local` exists — only `.env.example`, where `ANTHROPIC_API_KEY=` is blank (line 23).
- The Claude Code harness authenticates via an OAuth token bound to its own process
  (`CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR`), **not** a Messages-API key a subprocess can use.
  I did not attempt to exfiltrate or reuse that token — it's out of scope and likely fails/refuses.
- `ANTHROPIC_BASE_URL=https://api.anthropic.com` (the real API, not an auth-injecting proxy).
- A minimal live call therefore returns:
  `401 {"type":"authentication_error","message":"invalid x-api-key"}` (request_id req_011CdFtXH2AoiBMDEi8M6vix).

## What IS confirmed ready (so the run is trivial once a key exists)
- **No database required.** `generateProjectQuestions` and `generateRoomQuestions` are pure
  functions over an assembled input object — the Prisma queries live upstream in
  `getInterviewQuestions.ts` / `generateAllRoomQuestions.ts`, which we bypass. So the run
  touches **zero** project/production data.
- **Commits identified:** PRE = `09ffda5` (parent of step-2 `66f57c0`; before step 2 + generator #1),
  POST = `bb8daff` (current HEAD, includes step 2 arrivals reconciliation + generator #1 persona swap).
- **Fixed input** (same both runs) deliberately seeds the exact "leads" the source-narration
  craft targets — a relocation, a Chicago family, a ~14-month full gut — so the diff will show
  whether POST still holds those lightly (soft-impression, no name-reciting) rather than reciting them.

## Ready-to-run procedure (needs a real key)
```bash
# from repo root, with a real key exported:
export ANTHROPIC_API_KEY=sk-ant-...

# harness saved at (scratchpad): live-harness.ts  (also inlined at the bottom of this doc)
# 1) POST (current HEAD)
cp <scratchpad>/live-harness.ts ./live-harness.ts
npx tsx ./live-harness.ts > /tmp/post.json

# 2) PRE (worktree at 09ffda5 — only the code differs)
git worktree add ../folio-pre 09ffda5
cp <scratchpad>/live-harness.ts ../folio-pre/live-harness.ts
( cd ../folio-pre && ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" npx tsx ./live-harness.ts > /tmp/pre.json )

# 3) side-by-side
diff -y --width=200 <(jq -r '.projectOpeners[]' /tmp/pre.json)  <(jq -r '.projectOpeners[]' /tmp/post.json)
diff -y --width=200 <(jq -r '.kitchenQuestions[]' /tmp/pre.json) <(jq -r '.kitchenQuestions[]' /tmp/post.json)
git worktree remove ../folio-pre ; rm -f ./live-harness.ts
```

**Caveats to weigh when reading the diff:**
1. **Sampling noise.** Both generators call Claude at `temperature 0.7`, so PRE vs POST will
   differ partly from sampling, not only code. Read for *structural* shifts (persona voice:
   "journalist" → "colleague"; whether grievance/regret openers appear; whether the
   source-narration craft survives), not word-for-word. Running each side 2–3× and comparing
   the shape is more reliable than a single draw.
2. **`@/` alias.** The source files use `@/…` imports. `npx tsx` resolves tsconfig `paths` from
   the tree's `tsconfig.json`; if it doesn't in your version, run via
   `node -r tsconfig-paths/register --loader tsx ./live-harness.ts` (ts-node + tsconfig-paths
   are already devDeps).
3. **What the diff should show (do NOT auto-pass — surface for review):** generateProjectQuestions
   persona/framing change (#1) and generateRoomQuestions rule-3 wording + the arrivals gate
   dropping any grievance question (step 2). generateRoomQuestions' own persona ("senior editorial
   journalist") is **unchanged** — generator #2 hasn't run yet.

## Harness (inline copy of scratchpad/live-harness.ts)
```ts
import { generateProjectQuestions } from "./src/lib/interview/generateProjectQuestions";
import { generateRoomQuestions } from "./src/lib/interview/generateRoomQuestions";

const projectInput = {
  projectTitle: "Hillside Residence",
  projectDescription:
    "Young family relocated from Chicago; full gut renovation of a 1970s hillside house, ~14 months. Warm minimalism, lots of white oak and honed stone.",
  designerName: "Ana Reyes", studioName: "Reyes Studio", location: "Los Angeles, CA",
  projectType: "Full renovation", clientType: "Family", budgetBand: "$500K–$1M",
  representativeImages: [], roomNames: ["Kitchen", "Primary Bath"], roomTypes: ["KITCHEN", "BATH"],
  materialPalette: ["white oak", "honed marble", "unlacquered brass"],
  contextLevel: 3, respondentRole: "DESIGNER",
};
const kitchenInput = {
  roomName: "Kitchen", roomImages: [],
  roomTags: [
    { productName: "Unlacquered Brass Bridge Faucet", vendorName: "Waterworks", category: "FIXTURES", named: true },
    { productName: "Honed Calacatta Slab", category: "MATERIALS", named: false, descriptor: "honed marble island top" },
  ],
  budget: 5, contextLevel: 3,
  projectContext: {
    projectTitle: "Hillside Residence", designerName: "Ana Reyes", overallStyle: "warm minimalism",
    materialPalette: ["white oak", "honed marble", "unlacquered brass"],
    otherRoomNames: ["Primary Bath"], knownFacts: null,
  },
};
(async () => {
  const project = await generateProjectQuestions(projectInput as any);
  const kitchen = await generateRoomQuestions(kitchenInput as any);
  console.log(JSON.stringify({
    projectOpeners: project.questions.map((q) => q.text),
    kitchenQuestions: kitchen.questions.map((q) => q.text),
  }, null, 2));
})();
```

## To unblock
Export a real `ANTHROPIC_API_KEY` (or add it to `.env.local`) in an environment where a
subprocess can use it, then run the procedure above. I can drive it and produce the side-by-side
the moment a usable key is present — say the word and confirm how you want the key provided.
