# Folio

**Turn the story behind a designed space into a lasting project archive.**

Folio is an AI-assisted publishing platform for interior designers. It brings project photographs, product references, and the designer's own explanations together, then uses that material to prepare editorial features and social content for review.

The problem is simple: a portfolio photograph shows the finished room, but rarely captures why it works. Those decisions live in conversations, scattered files, and the designer's memory. Folio's interviewer, Sofia, helps capture that knowledge and connect it to the rooms and objects it describes.

[AI engineering tour](docs/AI_ENGINEERING.md) · [Development guide](docs/DEVELOPMENT.md) · [Regression journeys](docs/CORE_REGRESSION_JOURNEYS.md)

![Folio Publishing Studio with story suggestions, project photographs, and review actions](docs/reviews/studio-redesign/desktop.png)

*Publishing Studio preview from a local UI review, using synthetic stories and demo photography. [Preview context and verification](docs/reviews/studio-redesign/README.md).*

## From project archive to publication

1. **Bring in the project.** Upload photographs, organize rooms, and tag products to preserve the context behind each image.
2. **Tell the story.** Sofia asks about the project and individual rooms. Saved answers provide the source material for follow-up questions and writing.
3. **Review the draft.** Generate an illustrated editorial draft, review the text and quotations, and choose how the work is presented.
4. **Publish and reuse.** Publish the approved project and prepare further stories and social assets in Publishing Studio.

The repository also includes live avatar interviews, product attribution, designer profiles, and portfolio-based expertise stories. Availability depends on the configured services, feature flags, and account permissions.

## Engineering highlights

| Problem | Implementation | Start reading |
| --- | --- | --- |
| An AI conversation must survive retries and interruptions | Versioned interview state, request replay checks, and accepted answers saved before the next model decision | [Guided interview controller](src/lib/interview/guided/controller.ts) and [service](src/lib/interview/guided/service.ts) |
| A follow-up can sound plausible while inventing a premise | Structured proposals, source references, coverage checks, and a separate factual review for podcast-style questions | [Decision pipeline](src/lib/interview/guided/decision.ts) and [factual review](src/lib/interview/guided/factual-review.ts) |
| Generated writing must remain tied to the designer's evidence | Interview provenance, quotation verification, and an author review/publishing workflow | [Editorial generation](src/lib/posting/generateEditorialDraft.ts) and [quote provenance](src/lib/posting/verifyQuoteProvenance.ts) |
| Live speech and typed replies must share the same interview | A provider integration around Folio's canonical interview state and answer-saving paths | [Live interview adapters](src/lib/live-interview/adapters.ts) |
| Fast iteration needs repeatable checks | Application journey tests, interview regression scripts, and CI guards for client imports, migrations, and existing TypeScript debt | [Core journeys](scripts/core/journeys.test.cjs) and [CI workflows](.github/workflows) |

The [engineering tour](docs/AI_ENGINEERING.md) explains these choices, their tradeoffs, and where the verification stops.

## Stack

- **Application:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS.
- **Data and identity:** PostgreSQL/Supabase, Prisma 6, NextAuth, and application ownership/organization checks.
- **AI:** Anthropic for interview and editorial tasks; OpenAI integrations for transcription and embeddings; Tavus for the optional live conversation interface.
- **Infrastructure:** Vercel, Supabase storage, optional Upstash rate limiting, and separate media/render workers.

## Explore locally

Use Node.js 22 and npm. After cloning the repository:

```sh
npm ci
npm exec -- prisma generate
npm run test:core
npm run test:guided
```

These regression suites use synthetic data and mocked external services. The optional database tests require separate configuration. For the application itself, a development database, storage, authentication configuration, and credentials for the enabled AI features are required. Follow the [development guide](docs/DEVELOPMENT.md) before running `npm run dev`.

## Development approach and status

Folio is an actively developed solo-founder product built with AI coding assistance, including Claude Code and Codex. Product constraints, implementation reviews, and regression checks are part of that workflow. [Contributor guidance](CLAUDE.md) and [specialist review instructions](.claude/agents/README.md) show how the work is organized.

The repository includes established workflows alongside gated features and earlier experiments. TypeScript and lint debt are tracked through CI; a successful application build alone does not establish a clean typecheck. See the [current development constraints](docs/DEVELOPMENT.md#verification-and-current-constraints) for the relevant checks and limitations.
