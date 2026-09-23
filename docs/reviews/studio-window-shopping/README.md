# Studio window shopping — September 22, 2026

The previous Studio printed the pitch, process and destination on every card and crowded projects into a horizontal thumbnail strip. Browse cards now show a visual, an activity label and a specific title. Clicking opens a native modal containing the pitch and existing action. This applies to prepared posts, release plans, personal activities, readiness suggestions and expertise ideas. The page has shorter section headings; additional project stories share one section.

Project browsing uses All work / About me / Choose project. Choose project opens a searchable thumbnail gallery, with a visible selection and clear action. Format choices wrap instead of scrolling. Recommendations use a regular responsive grid.

## Expertise availability

My expertise was hidden because PR792 required an enabled environment flag. Following the user's correction, the shared server helper enables it by default; explicit `STUDIO_MY_EXPERTISE=false` remains an operational kill switch. Studio, author/API guards, public article/profile readers and project-return entry all use the same helper. No hosted environment, deployment or database was changed. An explicitly false hosted setting must still be changed to enable the feature there. This supersedes the default-off rollout noted in the previous expertise review; live-model quality/cost evaluation is still outstanding.

The empty expertise entry opens its setup in a modal. It does not claim a comparison exists, start an interview or run a model just because the designer browses.

## Verification

- Production compile, Next lint, TypeScript budget (903 against unchanged 904), client-import guard and migration discipline pass.
- Landing/readiness regressions updated to exercise real pitch dialogs: no navigation or preparation request on open/close, exact source/revision handoff on the explicit CTA, preserved saved-work behavior.
- New `check-studio-pitches.cjs` covers hidden details, read-only browsing, explicit action, Escape, focus restoration and searchable project selection. Added to CI.
- Expertise UI/default-on/kill-switch, service persistence and PostgreSQL-compatible constraint checks pass. Release, opportunity, activity and draft-removal checks pass.
- Browser reviewed at desktop and 375px mobile using actual components with synthetic API responses and demo photos. Verified pitch opening, keyboard dismissal/focus return, project search/selection, modal sizing and no horizontal overflow. This is UI evidence, not a production authentication/model evaluation.

Screenshots: [desktop](desktop.png), [expertise and About me](expertise-about.png), [mobile pitch](mobile-pitch.png). Local fixture: `STUDIO_PREVIEW_PORT=4186 node scripts/preview-studio-expertise.cjs` (set the variable using your shell's syntax).

No migrations, production data writes, merge or deployment in this implementation.


Current direction: the [Publishing Studio product standard](../../PUBLISHING_STUDIO_PRODUCT_STANDARD.md) supersedes this historical modal-first browsing review.
