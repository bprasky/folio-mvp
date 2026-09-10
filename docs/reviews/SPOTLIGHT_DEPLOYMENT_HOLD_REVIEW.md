# Separate operational review: Vercel Git deployment hold

PR #766 contains this explicit project configuration change:

```diff
 {
+  "git": { "deploymentEnabled": false },
   "regions": ["iad1"],
   "installCommand": "npm install --legacy-peer-deps",
   "buildCommand": "prisma generate && next build"
 }
```

**Purpose:** preserve the user's separate decisions to merge, apply a database migration and deploy. The earlier reviewed commit has a Vercel deployment status, so Git deployment was an active path. A migration-only PR would otherwise still be eligible for a Git-triggered build/deployment even though its feature has no public entry point. This hold exists because deployment is explicitly withheld, not because the two new tables require an automatic rollout.

**Scope:** this Boolean disables automatic Git deployments for every branch using this configuration in the linked Folio Vercel project. It includes main's production Git deployment and preview/custom-environment Git deployments from branches carrying the hold. It is not an account-wide or all-projects switch. Existing served deployments remain in place. A branch that does not contain this configuration cannot be assumed held; before merge, other branches still carrying the old file may deploy. After merge, main and branches inheriting it remain held until deliberately changed. [Vercel's documented Git configuration](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments) is the basis for this behavior.

**Evidence boundary:** the exact checked-in Boolean and official control semantics are the evidence. Absence of a Vercel status is **not** evidence of prevention. No deployment was deliberately triggered to test the hold. Authenticated dashboard overrides, independently configured hooks or manual/API deployment paths have not been audited, so this is not a claim that every possible deployment mechanism is disabled. Do not run those paths during this work.

**Merge behavior:** with this hold intact, the normal Vercel Git path is disabled. Inspected repository workflows do not deploy or apply migrations to the application database. The new PostgreSQL workflow runs only for pull requests and creates disposable containers with no application secrets. Merging does not itself apply this migration through checked-in automation. Database application remains the user's manual `npm run migrate:deploy` step after target, pending-list and recovery-point checks.

**Exact restoration procedure, for a later explicit deployment decision:**

1. Keep the hold through merge, manual migration application and verified database postflight. This PR does not authorize deployment.
2. When ready to resume normal Git deployments, create a separate operational change removing only `"git": { "deploymentEnabled": false },` from `vercel.json`. The remaining file is exactly the four-line configuration shown above without the added line. Leave the region/install/build commands unchanged.
3. Treat the **first push containing that removal as deployment-authorized**: its preview build can trigger. Merging the removal to the configured production branch can trigger production deployment. Do not push the restoration merely as a harmless preview while deployment is still withheld.
4. Confirm the intended project, production branch and environment binding in Vercel; review deployment history for the exact commit and desired environment. Restoring Git deployment does not apply database migrations: the build command remains `prisma generate && next build`. Keep the feature unexposed until its separate implementation/acceptance milestone is approved.

No restoration has been made. The hold remains clearly identified in the PR description and must be reviewed as an operational change distinct from the migration and TypeScript ratchet change.
