# Lessons Learned

Rules for Claude (and future contributors) to avoid repeating past mistakes.
Review at session start. Append — do not overwrite — new lessons.

---

## 2026-04-13 — Verify Path A vs Path B before adding feature flag gates

**Mistake:** When auditing the designer golden path, I identified two parallel publish paths:
- **Path A (Posting V1):** `/api/posting/project/[id]/status` + `/init` → used by the designer preview page
- **Path B (legacy editorial):** `/api/projects/[id]/approvals/publish-editorial` → calls `publishEditorial()` in `src/app/actions/projects.ts`

I correctly gated Path A on `NEXT_PUBLIC_POSTING_V1`, keeping Path B as the flag-off
canonical publisher per user direction. But I then **also** added a POSTING_V1 gate
to `createEditorialDraft()` in the same `actions/projects.ts` file, without checking
that it too is part of Path B. It is — called via
`/api/projects/[id]/approvals/draft-editorial` from `OverviewTab.tsx:143` and
`PublishWorkflow.tsx:77`. The errant gate would have broken the non-V1 draft flow
in production. I caught it one commit later and reverted.

**Rule:** Before adding a feature flag guard to any function in a shared module,
grep for ALL callers of that function and classify each call site as Path A or
Path B (or uncategorized). If any caller is on the path you're preserving, do
NOT add the gate.

**Specific check:**

```
# For any function you're about to gate:
grep -rn "functionName(" src/
# Then for each caller, trace up to the UI/route and ask:
# "Is this reachable with NEXT_PUBLIC_POSTING_V1=false?"
# If yes — do not gate.
```

**Related:** `src/app/actions/projects.ts` now has an explicit doc comment on
`createEditorialDraft()` explaining it's Path B and intentionally ungated. Don't
remove that comment.

**Second related mistake (same audit):** I also gated the entire
`PATCH /api/posting/project/[id]/status` endpoint, without noticing that
`usePublishFlow.unpublish()` at `src/hooks/usePublishFlow.ts:278` uses the
same endpoint with `{action: "unpublish"}` as the Path B unpublisher. Gating
the whole endpoint broke legacy unpublish when the flag was off.

**Fix pattern:** Gate the transition, not the endpoint. The status route
now parses the body first, computes `targetStatus`, and only enforces the
`POSTING_V1_ENABLED` check when `targetStatus === "PUBLISHED"`. Unpublish
and archive transitions remain reachable regardless of flag state.

**Lesson:** When an endpoint supports multiple actions (publish, unpublish,
archive), a flag check on the whole endpoint is almost always too coarse.
Determine the intended action first, then apply the flag gate only to the
specific action(s) that belong to the flagged feature.

---

## 2026-04-13 — Public vs draft query asymmetry

**Mistake avoided (from the tagging audit):** `getPostBySlug` (public post
fetch) and `getPostForStaging` (designer draft fetch) started out with
identical tag queries and no filter on `Product.isPending`. Pending products
are designer- or import-created stubs awaiting vendor claim; they often lack
a vendor, price, or canonical name. Filtering them out unconditionally in
staging would have broken the designer's ability to see and resolve their
own pending tags. Filtering them out on the public post is correct — a
public viewer should never see a half-finished tag.

**Rule:** Public-facing data fetchers and draft/preview fetchers often share
a base query shape but should NOT always share filters. When adding a
visibility filter, classify the call site:

- **Public / unauthenticated / shared links** → apply the filter.
- **Author / draft / editor context** → typically skip the filter so the
  author can still see and resolve incomplete data.

If you find yourself copy-pasting a query between `getPost*` functions,
ask which audience each one serves before propagating the filter.

**Files that demonstrate the pattern:**
- Public: `src/lib/post/getPostBySlug.ts` — filters `product.isPending: false`
- Draft:  `src/lib/post/getPostForStaging.ts` — intentionally unfiltered
