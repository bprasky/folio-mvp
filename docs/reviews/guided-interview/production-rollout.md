# Guided interview production activation — 2026-09-26

The user approved **Enable and redeploy now** after the missing production flag was identified.

## Observed state and change

- Vercel was already serving PR #799, commit `56dad57b5b895dc1b8ca23934b69157dd7958019`, through deployment `CMG4ckrTygdhWud2d2ByQANpwpwS`. The earlier assumption that this code was not deployed was incorrect.
- `NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW` was absent from both project and shared environment variables. Absence selects the legacy flow for new sessions.
- Added the non-secret config value `1` for **Production only**. Preview and development were not changed.
- Redeployed the same source with the latest settings and **without existing build cache**.
- Vercel reported [deployment 59xQXpdZ45pHdxAGwBjwk2GC8Td7](https://vercel.com/brad-praskys-projects/folio-mvp/59xQXpdZ45pHdxAGwBjwk2GC8Td7) **Ready**, assigned to `folioad.com`, at 13:31:38 EDT. The build completed in 3m 48s.

## Verification and limits

- `https://folioad.com/` returns HTTP 200 after the deployment.
- An unauthenticated GET to the guided interview API returns HTTP 401; authorization remains required.
- The inspection browser was not signed into Folio. A private project Start → first-question journey was not verified live. Anonymous project responses do not include the interview bundle, so the attempted public-asset flag inspection was inconclusive, not evidence that the flag is disabled.
- The actual entry components previously passed 11 browser scenarios, and the workspace passed 14. These remain local fixture evidence.
- No database schema, project answers, publication state, or protected spotlight enrollment was changed during rollout.

Reload an already-open project page before starting the interview so it loads the new deployment. Protected spotlight projects retain their existing dedicated flow. To stop new guided sessions, set this production flag to `0` and rebuild; saved guided sessions remain accessible for continuity.
