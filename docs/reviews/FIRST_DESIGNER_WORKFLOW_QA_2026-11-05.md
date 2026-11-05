# First designer workflow QA — November 5, 2026

## Outcome

Four review perspectives covered the first designer journey: live signed-out entry, signup/firm/website import, project preparation and recovery, and interview-to-publication. Five groups of confirmed defects were reproduced and repaired on `codex/designer-first-workflow-qa`. These changes are not deployed.

Baseline: `4675da22` (PR #845). Vercel's production deployment `dpl_4bj8LoqDwyaLgshQTG85kMeV7J1V` reports the same commit. Work uses a separate checkout and independent dependencies; the original workspace's unfinished work is preserved.

## Confirmed defects and fixes

| Priority | Designer experience before | Repaired behavior | Evidence |
| --- | --- | --- | --- |
| P1 | Entering a new firm named **North** when **North Studio** exists silently selects the other firm. Multiple partial matches disable creation. | Only exact normalized names auto-match. Partial suggestions remain available, while the entered distinct firm can be created. | Actual enrollment component; exact/partial/ambiguous matches, keyboard selection and submitted identity. Server duplicate protection is unchanged. |
| P1 | Imported project → **Tag products manually** opens tagging while the tracker says Rooms. Refresh returns to room sorting. | An explicit Tags destination remains selected when photographs exist. Default progression still starts with unfinished Rooms. | Actual tracker and media component before/after refresh; Rooms remains incomplete, empty-photo access is rejected, publication stays gated. Inner tagger is a marker fixture. |
| P2 | **Add project details first** clears the project name, completion year and month already entered. | Both project-entry forms retain all three values. | Actual `/projects/new` and `/designer/create` components; no project creation or call starts during the transition. |
| P1 | A completed live interview has no visible route toward its article. The draft action is hidden under saved-answer review; project-only answers cannot expose it there. | Completion offers **Review answers and prepare draft**. Any accepted answers can open the existing draft flow; unanswered rooms remain governed by the existing gallery behavior. | Composed host at desktop/phone widths; action preserves call and answers. Project-only answer regression reaches the existing Generate action exactly once. Empty-answer generation stays hidden. |
| P2 | Interview primary buttons become white text on near-white backgrounds in dark mode (measured contrast approximately 1.09:1). | Existing theme foreground token makes primary actions legible in both appearances. | Browser computed contrast is at least 4.5:1 for Resume, Generate, Send, Prepare editable draft and live restart. |

No schema, server authorization, generation prompt, feature-flag, publishing API or production data changes are included.

## Verification boundaries

| Check | Result | What it proves |
| --- | --- | --- |
| Live public entry | Passed | Welcome signup, return sign-in/signup and About navigation work; designer intent and first-project callback survive. Signup at 390px has no horizontal overflow; no captured console errors. |
| Firm enrollment browser | Passed | New regression described above, using synthetic search/session/mutations. |
| Signup verification and professional routing | Passed | Actual isolated SQL and route logic, including captured email; not external email delivery. |
| Workspace import | Passed | Actual extraction, worker, review and route orchestration with isolated PostgreSQL JSONB and external-service doubles; not a real website crawl or production cron proof. |
| Composed project/host browser | 28 passed | Actual UI with synthetic API/auth/provider/video, including populated manual handoff and completion CTA. |
| Guided entry browser | 19 passed | Actual interview UI with synthetic services, including theme contrast and project-only answers. |
| Manual room browser | 8 passed | Existing manual sorting plus imported tagging reload and readiness regression. |
| Live browser/capture | 46 passed | Isolated provider/video/capture behavior; not a real Tavus call. |
| Designer interruptions | 7 passed | Existing interrupted-save/retry browser scenarios with synthetic services. |
| Core regression journeys | 21 passed; 2 skipped | Actual route orchestration and authorization with deterministic data doubles. Disposable PostgreSQL runs were explicitly skipped. |
| Composed live media journey | Passed | Actual local media processing using ffmpeg, with synthetic provider/model/storage boundaries. |
| Live dependency reads | Passed | Configured Tavus face responds, private capture bucket/MIME configuration exists, and live transport/media tables exist. No call or recording was created. |
| Repository checks | Passed | Final Next compile-mode production build, full lint (existing warnings), client-import guard, migration-discipline guard and TypeScript ratchet: 851 existing diagnostics against the 862 baseline, with no new fingerprints. Compile mode does not prove deployed data access. |

The local configuration lacks the live backend origin and activation flags. Production has corresponding secret settings, but their values were not readable through the deployment connector. Do not infer production activation or account eligibility from local flags or redacted values.

The connected full Next.js/PostgreSQL journey was not run: no disposable database was configured and Docker was not running. No designated signed-in test account/site was provided during this pass. Real signup delivery, website import timing, voice quality, conversational relevance, and actual publication remain live acceptance checks.

Existing test-tool debt: `check-marketing-entry-browser.cjs` expects the older direct-project onboarding destination and predates email verification. `npm run diag` refers to a missing script. These were recorded rather than changed as part of the product fixes.

## Founder walkthrough

Use a designated test designer and a website whose content you may import. The fixes above require deployment before you can judge their revised behavior on the live site.

1. Start signed out in a fresh browser. Open About, choose **Start with a project**, then complete email signup. Record time to verification email, including spam-folder friction and resend behavior.
2. Create the firm. Try a legitimate name that resembles another firm's name; make sure the choice to create versus join is unambiguous.
3. Enter the website and start the import. Leave the page, then return through My Profile or the completion notification. Check that progress, errors and the next action make sense without explanation.
4. Review the imported firm identity, biography, photographs and projects against the source website. Confirm nothing has been published automatically and that incorrect or missing material can be corrected.
5. Pick one project. Open manual product tagging, refresh, and return again. Organize rooms, identify a few products, and intentionally leave one photo product-free. The tracker should explain what remains.
6. Start the interview. Answer naturally, including one answer covering several topics. Pause for a minute, correct an earlier detail, and switch to typing. Note repeated questions, awkward silence, irrelevant follow-ups, or unclear listening/saving status.
7. Leave and resume. Confirm accepted answers survived and that the interviewer continues from the right place. Complete the interview and follow the visible draft action.
8. Review the article, quotes, room images and credits. Check phone layout and dark appearance. Only publish a deliberately disposable test project when ready to make it public; then inspect the public link signed out.

For each snag, capture the screen, the action just taken, what you expected, what happened, and whether retry/refresh recovered. That lets the next pass reproduce the exact boundary instead of guessing.
