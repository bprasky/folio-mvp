# Publishing Studio recommendation briefs

## Shipped in this change

Project recommendations group the existing prepared room stories and overview. Pitches become the card headings below the Instagram preview; the actual export headline remains unchanged. One campaign action belongs to the project recommendation. Saved carousels, campaigns and kept interview directions remain in a separate, consistently ordered section. Existing project/type/search/status filters apply before grouping; each visible card appears once.

Ranking is deterministic, inexpensive and does not call an AI provider on page load. Supported room stories take precedence over an overview-only project. Publication within 30 days adds priority; publication at least 180 days ago permits archive framing. Unknown dates remain neutral. Recent saved carousel/campaign activity (14 days) reduces repetition. Equally scored projects take turns using a stable weekly tie-break. This is not an impression-history or social-performance model. No export is interpreted as a social publication.

The API supplies evaluation time. Refreshing within the same day preserves ordering for unchanged input. Publication age uses actual stored publication time, never project update time. The current source eligibility threshold is unchanged; recommendation grouping cannot manufacture weaker room stories to fill a section.

## Read-only audit, 2026-09-18

The connected database has `projects.publishedAt` and `projects.targetInstallDate`, but no completion date/year/month. Migration bookkeeping contains 110 records, zero unfinished. The declared `TrendSignal` table (`trend_signals`) is absent in the connected database. Source search found no collector/writer callers for it. Do not use this as a live signal or add a production query to that absent table. No migration or database writes were performed in this change.

## Completion date migration — approved and applied 2026-09-18

Add two nullable integers to Project: `completedYear Int?` and `completedMonth Int?`. Unknown is both null; year-only leaves month null. Month requires a year. No artificial January 1 timestamp. Year bounds 1800–9999; month 1–12. The future-date rule belongs in authenticated input validation relative to the current month, not a time-dependent database check. Existing publication and target-install fields retain their meaning.

Applied migration: prisma/migrations/20260918180000_add_project_completion_date/migration.sql. User explicitly approved the exact SQL and two nullable fields. Actual schema backed up before edits; validate/format/generate pass. Disposable PGlite PostgreSQL verified preservation, null/year/month combinations, constraint rejection and idempotent rerun (Docker was unavailable). Production migrate deploy applied only this migration; migrate status is clean. Readback confirms both integer columns and the validated constraint. No project values were backfilled.

Project information inputs and authenticated write validation remain follow-up work. Completion-aware ranking is not enabled until designers can supply those dates. The Studio UI and migration can merge together without claiming the date-entry feature is finished.

## Remaining intelligence

Measured Folio trends require an audited collection pipeline and fresh, sufficiently supported aggregate signals with privacy thresholds and an expiry. Match only to source-supported material/subject evidence. Omit trend reasons if collection is missing, stale or sparse. A trend never overrides the story quality floor.

Remembered impressions, snoozes and confirmed external posting are separate from current saved activity. Their persistence and explicit user feedback are follow-up work; the current release must not claim to know whether an exported Instagram post was published or how it performed. Preserve saved drafts when ranking changes. Actual interview activities still require the previously proposed persistence/backend work.
