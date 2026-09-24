# Smart firm enrollment browser fixture

Run `node scripts/build-firm-enrollment-preview.cjs --serve`, then open http://127.0.0.1:3187.

The fixture bundles the actual `ScenarioA` React component and compiles the repository's global Tailwind and auth CSS. It reuses locally cached Next build fonts when available. Rebuild after source edits.

Cases:
- `/`: first firm; type **North** and select **North Studio**, then request access.
- New name: create form requires confirmation; submit displays the intended destination.
- **Duplicate Studio**: search reports no result, creation returns a synthetic concurrent duplicate; component switches to the existing firm's join action.
- **Error**: synthetic search failure; create remains unavailable and retry is shown.
- `/?mode=memberships`: two memberships; choose a workspace or add another firm.
- `/auth/org-setup?add=1`: add a firm while retaining existing memberships.

`window.fixtureCalls` records synthetic browser API requests. All `fetch` calls are intercepted and unknown endpoints throw. Navigation destinations appear in a banner instead of entering the real app. Authentication, email, persistence, server-rendered redirects, and production middleware are mocked and are not verified by this fixture. No production data, account, email, or network writes occur.

Generated bundles are ignored. The preview binds only to loopback and refuses to replace an existing process on port 3187.

Verified in the browser at 390 × 844 on 2026-09-24: keyboard selection without submission, explicit join → pending, confirmed creation → project destination, duplicate conflict → existing firm action, failed search → disabled creation, active membership selection, and Add another firm. `mobile-create.png` captures the actual component. Desktop join form was also inspected. Live application authentication, persistence and email are not verified by this fixture.

The founder approved the additive member-posting policy migration and merge. The exact migration was applied/recorded with clean status; Prisma validation/generation and production compile pass. The schema scope guard now pins only that approved addition. No application deployment was triggered (automatic Git deployment is disabled in this repository).
