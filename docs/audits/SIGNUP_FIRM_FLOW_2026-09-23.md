# Signup and firm onboarding audit — 2026-09-23

Original scope: supplied mobile screenshot and read-only source audit at 2f844f15. Findings below describe the original implementation, not the exact path the tester took. Follow-up implementation is on codex/smart-firm-enrollment. The founder approved the member posting policy schema addition and merge on 2026-09-24; the exact migration was applied and recorded, and migrate status is clean. No live signup, email or application deployment was performed during validation.

## Recommended product flow — corrected by founder, 2026-09-24

The person holds one lifelong account. Firms are separate organizations with their own memberships and permissions. A browsing account cannot publish. Professional enrollment is required, and publishing must be authorized for the specific organization attached to the work. A self-selected professional label or a workspace switch is not authorization.

The founder's final direction supersedes separate Find/Create choices: **one smart firm-name field** searches while typing. Selecting a match (or a unique search result) changes the primary action to **Request access to join firm**. No match reveals the minimal firm type and creator confirmation fields, with **Create firm** as the primary action. There is no solo shortcut around firm creation. An independent designer creates their own practice under the same personal identity.

1. **Find my firm.** Labeled search with firm identity details, then Request to join. An approved invite may use its existing acceptance path. Pending requests stay pending and do not grant publication. Do not send existing members through signup again; resolve their access before rendering enrollment.
2. **Create my firm.** The name field also searches/autocompletes existing firms. If the firm already exists, guide the person to join/request access or the authorized claim path instead of creating a duplicate. Retain the owner/employee distinction; entering a firm's name does not establish ownership. Keep additional fields minimal.
3. **Duplicate prevention.** Enforce shared server-side identity checks across all create routes, including concurrent submissions and retries. Autocomplete is assistance, not enforcement. Search across existing firm types/capabilities so changing a role does not hide the same organization. Normalize names for matching and use domain/location to disambiguate; two distinct firms can legitimately share a display name. An exact identity conflict must reuse the existing organization; similar names require disambiguation, not silent merging. Resolve and review the database-level strategy before implementation.
4. **Finish.** State whether access is approved, pending or requires firm verification. Select the authorized organization and refresh the session before returning to the intended action. Firm creation alone must not promise posting access before its eligibility policy is satisfied.
5. **Add another firm.** An authenticated person uses the same Find/Create forms in an Add another firm context. No new personal account, repeated signup, or forced modification of the employer's capabilities. A day-job MEMBER can also be OWNER of a separate side practice. Permission in one firm never transfers to another.
6. **Returning members and career changes.** Sign in with the existing personal account, then enter the appropriate firm workspace. If browsing in personal context, a posting action resolves eligible memberships before opening enrollment. Multiple eligible firms require an explicit choice; zero memberships leads to Find/Create. Leaving a firm removes its access while retaining the personal account and other memberships. It does not transfer ownership of the former firm's projects.

All individual-account posting actions must enter the same professional access journey. Signed-out people see sign-in/sign-up with professional intent and a safe return destination; signed-in people keep their identity and go directly to firm setup or authorized workspace selection. Account creation, professional enrollment and paid upgrades must not be conflated. Browsing remains available without posting permission.

Resolved policy: creator confirmation grants ownership and posting immediately. Joining an existing firm requires active admin approval. Approved members can publish by default, with an organization admin opt-out setting; OWNER/ADMIN/MANAGER permissions remain. This establishes firm accountability and does not verify a business address. Stronger verification and disputes are deferred by the founder. Self-confirmation does not set verifiedAt/verifiedBy.

## Implementation and verification — 2026-09-24

- Canonical setup, legacy redirects, safe authentication callbacks and active workspace selection preserve one account and multiple firm memberships.
- All public organization create aliases use the same transaction, normalized-name lookup and advisory lock; rename uses that same check. Current exact normalized names are blocked across types. Similar names and legitimate same-name firms require a later disambiguation/support policy; no automatic merge or historical deduplication occurs.
- Join requests create Folio inbox/bell notifications and admin email using existing infrastructure. Pending retries do not resend; no-admin firms show a support recovery path. Provider email acceptance is distinguished from failure, not represented as delivered. Notifications are best effort after the durable request; no retry outbox is added.
- Posting gates cover firm project publication, collaboration approval and Studio publication. Project creation checks the actual target organization's active membership and supported type. Withdrawal remains available when posting rights are removed.
- Core deterministic journeys: 8 passed, 1 disposable-database test skipped. Focused enrollment, callback, notification, and permission checks pass. Browser fixture verifies 390px mobile layout, keyboard selection, request confirmation, creator confirmation, duplicate-conflict recovery, search failure, workspace selection and second-firm entry. These tests mock persistence/email; PostgreSQL concurrency and live delivery are not proven.
- Approved and applied: organizations.membersCanPublish BOOLEAN NOT NULL DEFAULT TRUE and matching Prisma field. Prisma format/validate/generate and sync verification pass. All four existing firms default to enabled; no NULL values. Exact-schema guard pins the approved migration and rejects altered policy defaults.
- Final validation includes production compile, core journeys (8 passed/1 disposable-DB skipped), firm access (17 passed), permission checks (5 passed), and 39 enrollment/Studio regression scripts. Live email delivery and database-level concurrent signup remain outside synthetic test coverage.

See docs/reviews/smart-firm-enrollment/README.md and mobile-create.png for the actual component preview.

Mobile shell: one small Folio mark, one heading, short helper copy, visible field labels, and one primary action. Remove app navigation/footer from onboarding; avoid a second full-screen shell inside the app shell. Put Back and progress near the form. Use responsive height and spacing with the keyboard open. No forced focus on the first mobile render.

## Findings and evidence

### High priority — duplicate enrollment and different permission rules

- Signup's professional branch enters `/auth/org-setup`; its owner success enters `/onboarding/diagnostic`. Org setup creates membership but does not mark firm onboarding complete. Diagnostic sends professionals to `/onboarding/firm`; FirmPage checks only the timestamp, not existing membership. Someone who already created a firm is asked again. Create/solo can create another organization.
  Evidence: `src/app/auth/signup/page.tsx:32`, `src/app/auth/org-setup/_ScenarioA.tsx:219`, `src/app/api/auth/org-setup/route.ts:114`, `src/app/api/onboarding/diagnostic/route.ts:56`, `src/app/onboarding/firm/page.tsx:18`.
- The org-setup flow requests approval through `/api/orgs/[orgId]/join`; firm enrollment directly upserts active MEMBER membership for non-vendor organizations. It can also reactivate an inactive membership. The diagnostic allows choosing a professional role, so this difference is not confined to previously approved firm members.
  Evidence: `src/app/auth/org-setup/_ScenarioA.tsx:156`, `src/app/api/onboarding/firm/enroll/route.ts:75`, `src/app/api/onboarding/diagnostic/route.ts:39`.
- New firm creation always grants OWNER in firm/enroll. The separate org-setup flow distinguishes owner from employee. Solo silently creates an organization using the person's name. Both firm/enroll create branches omit capabilities, which org-setup initializes.
  Evidence: `src/app/api/onboarding/firm/enroll/route.ts:93`, `src/app/api/auth/org-setup/route.ts:83`.

### High priority — completion does not guarantee a usable first-post path

- Neither enrollment path sets `operatingAsOrgId`. Profile preview leads to `/designer/create`, whose live default renders `UnifiedCreateProjectUI`. Without workspace context it shows “Select a firm” and Back to Projects, with no Find/Create firm action. The API independently requires an explicit organization or saved operating context. Correction from the September 23 audit: the legacy form around line 46 of designer/create is not the active renderer, so the immediate failure is a blocked screen, not that form's submission error.
  Evidence: `src/app/onboarding/profile-preview/profile-preview-actions.tsx:36`, `src/app/designer/create/page.tsx:338`, `src/components/UnifiedCreateProjectUI.tsx:88`, `src/app/api/projects/route.ts:123`.
- New organizations are UNCLAIMED, including the founder branch; the central publishing helper requires CLAIMED/PROFESSIONAL. Founder creation issues no claim invite. The signup sequence therefore does not itself establish posting eligibility. Decide and implement the owner verification/claim completion path explicitly; don't promise immediate publishing merely because creation succeeded.
  Evidence: `src/app/api/auth/org-setup/route.ts:90`, `src/app/api/auth/org-setup/route.ts:122`, `prisma/schema.prisma:1058`, `src/lib/permissions.ts:461`.
- Organization eligibility is enforced by Posting V1 and collaboration-story publishing, but the legacy `publishEditorial` → `transitionEditorial` path has no equivalent organization-status check. The stated “must join/create an org before posting” rule is not a uniform server invariant. The helper's explicit-org branch also checks org status without checking the user's active membership; caller authorization needs to remain separately audited. This is a contract gap, not a claim of a demonstrated live exploit.
  Evidence: `src/app/api/posting/project/[projectId]/status/route.ts:46`, `src/app/api/collaboration/stories/[id]/publish/route.ts:69`, `src/app/actions/projects.ts:42`, `src/lib/editorial/lifecycle.ts`, `src/lib/permissions.ts:465`.

### Direct friction on the supplied screen

- **Skip returns to the same step.** The button navigates to bio without saving state; bio redirects back when firm context is absent. `src/app/onboarding/firm/firm-form.tsx:287`; `src/app/onboarding/bio/page.tsx:35`.
- **Create is hidden when wrong matches exist.** It appears only after a successful-looking empty result. `firm-form.tsx:258`.
- **Search failure looks like no match.** Catch clears results and marks search complete, inviting duplicate creation after a network error. `firm-form.tsx:60`.
- **Search races.** In-flight requests are not aborted or checked against the current query. Deleting text during debounce can leave searching stuck because the short-query branch does not clear it. `firm-form.tsx:41–69`.
- **A result click immediately joins.** No selection confirmation or visible Join action. `firm-form.tsx:231`.
- **Mobile chrome is stacked.** RoleBasedLayout excludes `/auth/` but not `/onboarding/`, so navigation and footer wrap an onboarding shell with another logo and `min-h-screen`. SimpleLayout adds padding and another minimum viewport height. This matches the duplicate branding and excessive vertical space in the screenshot; exact pixel behavior still needs browser verification. `src/components/layouts/RoleBasedLayout.tsx:22`; `src/components/layouts/SimpleLayout.tsx:6`; `src/components/onboarding/OnboardingShell.tsx:20`.
- **Form affordances are weak.** Search has only placeholder text; create uses divs and click handlers rather than a submit form. Progress dots are all aria-hidden without a text equivalent. These should be labeled, keyboard-submit forms with visible status/error announcements.

## Implementation sequence

1. Consolidate firm enrollment rules and reuse membership/pending state; close direct-join/reactivation bypass. Keep existing owner/member distinctions.
2. Implement the short forms and clean onboarding shell, including truthful error and pending states.
3. Persist skip/resume behavior and selected workspace context; prevent duplicate create on retry/double-submit. Refresh client session after role or context changes.
4. Make posting eligibility consistent across both publishing paths, preserving their feature-flag behavior. Define the owner claim completion before changing its policy.
5. Validate the entire signup-to-first-project flow, then mobile presentation.

## Acceptance checks before shipping

- New individual browsing; professional joining an existing firm; existing active member; pending/rejected request; inactive former member.
- Missing firm created by owner vs employee; solo with edited practice name; no duplicate organization after refresh, back or retry.
- Search failure/retry, slow out-of-order responses, clear while searching, unrelated results, and create-name prefill.
- Skip survives navigation and sign-in; an existing firm is not asked for again; the intended posting destination is retained.
- First project works without a manual workspace switch; unclaimed/pending states show the right next action; both publish paths enforce the same membership/status policy.
- Real mobile browser at narrow widths, keyboard open, browser back, keyboard submit, focus order, accessible labels/status, and no duplicate header.

Review: screenshot inspection plus source tracing completed. No live browser, database, or production reproduction was performed; implementation and runtime acceptance checks remain future work.

Additional permission detail: the current org capability matrix reserves project publication for OWNER/ADMIN/MANAGER; MEMBER can contribute but cannot publish. `src/lib/orgPermissions.ts:84` and `src/lib/editorial/lifecycle.ts:73`. If the intended product is that every approved individual member can publish their own work, that is a separate permission-policy change to resolve alongside the form redesign. The UI must not imply that joining automatically grants publishing permission.

Pending-request detail: org-setup redirects to home without completing the diagnostic; middleware can send the applicant back to diagnostic. Selecting a professional role then routes to the alternate direct-join screen. Preserve a durable pending/browsing state when consolidating. `src/app/auth/org-setup/_ScenarioA.tsx:166`, `middleware.ts:66`.


## September 24 route and enforcement addendum

Source review only; these are implementation gaps, not completed fixes.

| Entry / behavior | Current implementation | Required behavior |
|---|---|---|
| Masthead Create | `src/components/navigation/CreateButton.tsx:106`: all signed-in non-vendors to `/projects/new` | Individual without eligible firm enters professional setup before project entry |
| Mobile Create | `src/components/navigation/MobileMenu.tsx:125`: `/projects/new` | Same professional-entry resolver |
| Project list New project | `src/app/projects/ProjectsPageClient.tsx:348` and `:760`: `/projects/new` | Same resolver, with selected firm checked server-side |
| Direct project form | `src/app/projects/new/page.tsx:301`: loading guard, no enrollment guard; API error surfaced as toast | Resolve auth/membership before offering form; server remains authoritative |
| Missing designer workspace | `src/components/UnifiedCreateProjectUI.tsx:88`: Select a firm + Back to Projects | Existing memberships go to workspace selection; none to Find/Create |
| For Professionals | `src/app/professionals/page.tsx:27`: signed-in to org setup, signed-out to generic signup | Preserve professional intent and intended destination across both sign-in/sign-up |
| Sign-in | `src/app/auth/signin/SigninForm.tsx:36`: credentials goes home; OAuth at `:66` and `:77` also uses home | Accept validated internal destination and preserve it in auth cross-links |
| Sign-up | `src/app/auth/signup/page.tsx:40`: defaults browsing; no incoming intent/callback parsing | Professional entry remains professional, using the same personal account |
| Join alias | `src/app/professionals/join/page.tsx:23`: carries type only | Preserve selected firm and safe intended destination |
| Existing-member org setup | `_ScenarioB.tsx:169`: starts with hybrid capabilities | First-class Find my firm / Create my firm for another affiliation |
| Account settings | `src/app/settings/page.tsx:125`: org-setup action only for zero orgs | Add another firm remains available with existing memberships |
| Older professional form | `src/app/professionals/[role]/organization/page.tsx:207`: separate `/api/orgs` creator | Retire/redirect or share canonical enrollment service; cannot bypass checks |

### Duplicate prevention is currently absent across the main creators

`/api/auth/org-setup`, `/api/onboarding/firm/enroll`, `/api/organizations`, and the raw-SQL `/api/orgs` creator all insert without a shared normalized identity check. The latter has a generic unique-error handler, but the checked-in Organization model does not make name unique; catching that error is not proof of duplicate prevention. No live database uniqueness check was run. `_ScenarioA.tsx:141` searches `query`, not the changing `createName` at `:594`, so create-name autocomplete is absent.

The fix must cover all entry points, imports/writers relevant to public enrollment, and concurrency, not just disable a frontend Create button. Block confirmed same-firm creation, return the existing firm for access request, and present likely matches with identity details. Do not merge two firms automatically or globally prohibit legitimate same-name businesses. Existing duplicates need separate scoped review, not automatic deletion.

### Career continuity and specific-firm authorization

`OrganizationUser` already has a unique user/organization pair and a role per membership (`prisma/schema.prisma:1183`). Keep that structure. The global User.role influences navigation but must not substitute for membership authorization. Publishing a side-practice project requires permission in that side practice; being OWNER there must not allow publication in the employer firm where the person is MEMBER. Returning members should never repeat account signup merely because an onboarding timestamp is missing.

Workspace GET and POST currently use raw membership queries without `isActive` filtering (`src/app/api/user/workspace-context/route.ts:40` and `:139`). Fix this as part of the career-change boundary so removed memberships disappear from selectable contexts; publication must still recheck active membership at the time of action.

### Additional access-control gap relevant to the founder's goal

The older claim endpoint `src/app/api/orgs/[orgId]/claim/route.ts:65` requires existing active OWNER/ADMIN only for vendor-type organizations. For other unclaimed organizations, an authenticated caller can reach the transaction that marks CLAIMED and grants OWNER, demoting existing owners to ADMIN. It does not require an approved identity/claim proof for that branch. This source-confirmed route would undermine the intended professional gate even if the forms were consolidated. It needs to share the canonical authorized claim process; no production exploit was attempted.

### Revised release acceptance cases

- A browsing individual cannot publish through any server endpoint, including direct requests that bypass the UI.
- Selecting Designer in onboarding alone never authorizes posting.
- Professional sign-in/sign-up returns to the intended action without creating a second account or losing the selected firm.
- Existing active members do not see signup again, including when historical onboarding timestamps are absent.
- A member at employer A can create/join firm B on the same User record without altering A or elevating permissions there.
- Exact duplicate creation, repeated submissions and concurrent same-firm creation return the existing firm; close-but-distinct names are explicitly disambiguated.
- Switching employer or removing a membership immediately removes former-firm posting access; other memberships remain intact.
- New firm creation, joining and claiming enforce the chosen firm-eligibility rule. The UI reports pending/approved states truthfully.

Status: clarified audit and route contract complete. Application changes, live QA, database deduplication strategy and the newly-created-firm eligibility decision remain implementation work. No schema, authentication, membership or publishing behavior changed in this audit.
