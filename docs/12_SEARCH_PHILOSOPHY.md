# 12_SEARCH_PHILOSOPHY

## Purpose
This document defines how search works on Folio. Search is not a utility feature—it is a core expression of Folio's editorial identity and a primary driver of the platform's intelligence layer.

## The Core Principle

**Search on Folio does not return results. It returns a curated edition.**

The atomic unit of Folio search is the **moment**—a specific image inside a project that demonstrates a design decision, material relationship, or spatial treatment.

Projects are containers. Moments are the currency.

This principle applies universally:
- Public discovery across all of Folio
- Private search within a designer's own work
- Trend analysis and editorial assembly
- Client presentation workflows

The mental model is a magazine, not a database. When someone searches "blue pools," Folio does not say "here are 12 projects that contain blue pools." Folio says "here is the Blue Pools Edition"—a curated spread of the exact moments inside projects that match.

## What Search Is Not

Folio explicitly rejects traditional search UX:

- ❌ Not Google-style ranked results
- ❌ Not Pinterest boards detached from source context
- ❌ Not a list of project links to browse
- ❌ Not "search → project → scroll → find the thing"

That flow breaks inspiration, kills editorial energy, and feels utilitarian. Folio is not utilitarian.

## The Edition Model

Every search query generates an **edition**—a real-time editorial assembly drawn from Folio's indexed moments.

### How Editions Work

1. User enters a search term or applies a lens
2. Folio identifies matching moments across the relevant scope (public or private)
3. Moments are assembled into an editorial spread
4. The experience feels like opening a magazine issue built in real time

### Edition Presentation

The resulting page behaves like an editorial spread:
- Full-bleed imagery
- Generous white space
- Subtle typographic framing
- No "results count"
- No sorting dropdowns

The user feels like they are browsing a curated collection, not querying a database.

### Project Entry Is Secondary

The image comes first. The project is revealed only if the user wants it.

On interaction:
- Clicking an image expands it and reveals subtle context (designer, location, tags)
- A secondary action allows the user to "View this project"
- If the user enters the project, they land at that exact image—not the top of the project

This preserves inspiration flow for casual browsing while providing depth for professionals who want context.

## Permission Scopes

The same search architecture applies at two scopes:

### Public Search
- Searches across all published projects on Folio
- Returns an edition of moments from across the platform
- Attribution intact (designer, vendor, products)
- Engagement signals tracked (saves, shares, views)

### Private Search (Designer)
- Searches across the designer's own project files
- Includes both published and unpublished/draft projects
- Unpublished moments appear in a separately marked section
- Unpublished moments can be excluded easily if desired
- Published moments take visual precedence

Private search uses the same moment-level logic. A designer searching "brass" across their portfolio receives a curated feed of their brass moments—not a list of projects to dig through.

## Lenses

Lenses are editorial filters, not database facets.

### What Lenses Are

Lenses modify the edition without re-running a query. They re-weight, re-order, and re-frame the assembled moments.

Examples:
- "Mediterranean"
- "Coastal Minimal"
- "Hotel-inspired"
- "Stone-Forward"
- "Residential vs Hospitality"
- By room
- By material
- By project status (for private search)

Applying a lens feels like flipping to a different section of the same magazine—not refining a search.

### Lenses as Assembly Tools

Lenses are not just viewing modes. They are steps toward output.

A lens assembles moments so the user can:
- Share a collection to Instagram
- Add selected moments/products to a project file
- Generate a shareable PDF for client presentation
- Publish as a post on Folio

The lens is a creative act, not retrieval.

## Search Signal Architecture

### Semantic vs. Tagged Search

When a user searches "marble," Folio returns:
1. **Explicit matches** (priority): Moments where a marble product is tagged
2. **Detected matches** (secondary): Moments where marble is visually present (AI detection)

Both appear. Explicit takes precedence in ranking.

### Tagging Prompts from Interest Signals

When users search for or engage with untagged materials, Folio generates prompts for designers:

> "Users are interested in the marble in this photo. Add a tag to invite the vendor to collaborate."

This converts passive interest into:
- Active vendor collaboration invitations
- Affiliate marketing setup opportunities
- Engagement loop completion (user who saved gets notified of updates)

The designer doesn't guess what to tag. Folio tells them based on what the platform wants.

### Proactive Designer Prompts

Private search generates less signal than proactive platform prompts. The primary value is Folio actively telling designers what content is in demand.

> "Many users are searching for blue. Do you want to edit and share this blue edition we composed from your work?"

Folio operates as a growth partner:
- Identifies trending searches
- Pre-assembles editions from the designer's moments
- Prompts the designer to publish
- Removes friction from content creation

The designer doesn't figure out what to post. Folio tells them what's hot and does the assembly work.

## The Content Pipeline

Search trends directly fuel editorial production:

```
Search trends observed
    ↓
Trending moments identified (with attribution)
    ↓
Editorial edition assembled
    ↓
Designers featured (compounding value)
    ↓
Engagement metrics captured
    ↓
Metrics inform future search ranking
    ↓
Cycle continues
```

This creates a closed loop no competitor can replicate:

**Search trends → Editorial fuel → Designer attribution → Real engagement metrics → Back to search**

"Brass is trending" becomes an editorial trigger. The material highlight assembles itself because Folio has:
- The exact moments
- The designer attribution
- The vendor attribution
- The engagement data to prove performance

No slop. No random images. Every moment is attributed and traceable.

## Terminology

This document avoids the term "moodboard" due to ambiguity.

### Workflow (Internal Organization)
- Adding products to project files
- Adding moments to rooms
- Organizing work in progress

### Presentation (Client Communication)
- Shareable PDFs
- Shareable links
- Pre-publishing client review

These are distinct workflows. Search supports both:
- Search → select moments → add to project file (workflow)
- Search → select moments → generate shareable PDF (presentation)

## Why This Architecture Matters

### Data Granularity
Operating at the moment level captures which specific design decisions resonate—not which projects are popular. This is the data vendors will pay for.

### Attribution Integrity
Unlike Pinterest, moments on Folio know where they came from. Designer, products, vendor relationships—all intact. When someone wants to go deeper, the context is there.

### Professional Cognition
Designers don't search for "projects that contain X." They search for moments that demonstrate a specific treatment. Folio matches search experience to how professionals actually think.

### Trend Attribution
Folio is the only platform where trending content is attributed and traceable. Pinterest can say blue is trending. Folio can say which designer's blue moment is driving it, which vendor's product is in that moment, and give credit to the designer who started the trend.

This is the moat.

## Alignment with Constitution

This philosophy supports core constitutional principles:

- **Designers are the primary gravity well**: Search surfaces their moments with full attribution
- **Editorial is a status achieved**: Search-driven editions elevate projects based on merit and engagement
- **Merit over pay-to-play**: Trending moments surface because users want them, not because someone paid

## Implementation Notes

This document defines philosophy, not technical implementation. Key implementation considerations:

1. Moment-level indexing must capture: visual content (AI), explicit tags, spatial context, product relationships
2. Edition assembly must feel instantaneous
3. Lens application must feel like page-turning, not query refinement
4. Private vs. public scope must be clearly enforced at the data layer
5. Proactive prompts require trend detection running continuously

Technical architecture belongs elsewhere. This document governs intent.
