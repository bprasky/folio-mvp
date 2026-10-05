# Completed-project intake review

Date: 2026-10-05

## Product decision

Initial intake is for a designer's completed archive. Hide Concept and In progress choices; retain their underlying project models and workspaces for a later feature review. A completed interior can still have a private, unfinished Folio entry. Completion date is separate from upload, publication and last-edit dates.

The founder confirmed month and year, with year-only for older projects. Store an unknown month as null. Never substitute January or the upload date. The current change saves those existing database fields, displays the date on designer project cards and adds a Completion date sort (newest year/month first, unknown months after known months in the same year, undated projects last).

## Proposed single factual page

Heading: **Add a completed project**. Supporting text: **A few facts about the project. We'll help tell its story later.**

| Visible question | Input | Why collect it now? |
| --- | --- | --- |
| Project name | Short text; use the studio's existing name | Recognize and find the project |
| Where is it? | City, state/region, country; no street address | Search, location context and accurate attribution |
| What type of project? | Residential, hospitality, commercial, retail, etc. | Structure the archive and guide later questions |
| What work did your studio do? | Concrete scope choices; allow multiple where appropriate | Replace vague description-writing with factual context |
| When was it completed? | Required year; month if known | Order the portfolio by the actual work |

One primary action: **Continue to photos**, opening the upload controls directly. No stage choice, Advanced details disclosure, readiness screen, interview invitation or paragraph-writing task on this page. Photos lead directly to room organization after successful upload. Tavus stays in Story.

Follow-up decision: remove AI photo room detection. Uploads and empty room boards no longer launch automatic detection; the room menu starts with no inferred selection. Designers create, name and assign their own rooms. Both retired detection endpoints return 410 to old clients. Existing room assignments, product tagging, reviewed document extraction and independent background search indexing are preserved.

Scope labels still need product review: the existing Discipline list mixes Full interior, Furniture & FF&E, Renovation and Styling. These overlap, so forcing a single choice is misleading. Avoid asking designers to define an aesthetic, invent a concept or write marketing copy during setup.

## Where the other questions belong

| Existing question | Recommendation |
| --- | --- |
| Description | Remove from initiation. Derive the narrative from photos and factual interview answers later; let the designer review it. |
| Cover image | Choose from uploaded photos in the photo workspace. |
| Tags | Collect room/product/material facts in their existing tagging steps. |
| Visibility | Keep the entry private by default; ask at publication. |
| Collaborator/photographer credits | Collect alongside photos/rooms and require any necessary attribution before publication. |

## Persistence audit and implementation boundary

The stage restriction and completion-date change are implemented in this PR. The table above is the review specification for replacing the two legacy detailed forms with one shared factual page; that wider replacement is not implemented yet.

- Project name, project type, city, region/state and description have storage and downstream consumers.
- Completion year/month already existed in the database but intake did not save them. They now pass through validation, create/edit and the designer project query.
- The `/projects/new` detailed form displayed Year, Discipline, Tags, Visibility and Cover but did not send those values. The Year defect is fixed by this change. Do not preserve controls that appear to save data while dropping it.
- Country and scope/discipline need an agreed storage contract before the new page collects them. Do not hide them inside description or claim they are already persisted. Any schema additions follow the repository's migration review and approval process.
- Collaborator credits currently attach to ProjectPost. The existing credit editor cannot reliably save before that record exists; address that persistence boundary when moving credit collection.
- The three main intake forms now explicitly use the PAST timeline. Separate sourcing/save-to-project modals still have inline project creation; audit these when making the restriction app-wide, without misclassifying a sourcing board as completed work.

No schema migration, production writes, paid call or production deployment is part of this change.
