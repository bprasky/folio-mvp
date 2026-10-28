import { legacyInterviewBoundary } from '@/lib/spotlight/legacyBoundary';
import { stripPrivateInterviewData } from '@/lib/spotlight/privacy';
export const dynamic = 'force-dynamic';
// Editorial generation is the heaviest LLM call in the app — a multi-room draft
// runs for minutes. Without an explicit ceiling this route inherits Vercel's
// implicit default and can be killed mid-generation (platform 502). 800s is the
// Pro + Fluid Compute cap (Fluid Compute is enabled on this project); it gives
// the largest multi-room drafts room to finish synchronously. If Fluid Compute
// is ever turned off, this MUST drop back to 300 or the build fails.
export const maxDuration = 800;

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { Prisma } from '@prisma/client';
import { jsonObject } from '@/lib/editorial/lifecycle';
import { assertProjectWrite, assertProjectPublish } from "@/lib/authz/access";
import { BlocksSchema } from "@/lib/posting/schemas";
import { preservePresentation } from '@/lib/story/presentation';
import { savedEmbeddedQuoteChoices } from '@/lib/posting/embeddedQuotes';
import { generateEditorialDraft, type GenInput } from "@/lib/posting/generateEditorialDraft";
import { rateLimit } from "@/lib/rateLimit";
import { logPassiveEvent } from "@/lib/analytics";
import { cid } from "@/lib/utils/correlation";
import { summarizeBudget, ensureUnder } from "@/lib/posting/contextBudget";
import { compactImages, compactProducts, frameNarrativePrompt, softModerate } from "@/lib/posting/promptBuilders";
import Anthropic from '@anthropic-ai/sdk';
import { formatRoomName } from '@/lib/utils/formatRoomName';
import { buildRoomResolver } from "@/lib/posting/resolveImageRoom";
import { resolveDesignerBio, siblingProjectsWhere } from "@/lib/posting/generationContext";
import { callLLM } from "@/lib/posting/llmClient";
import { z } from "zod";
import { LlmComposedLooseSchema, ComposedDraftSchema } from "@/lib/posting/schemas";
import { MODELS } from '@/lib/ai/models';

const USER_DAILY_LIMIT = 5;
const PROJECT_MINUTE_LIMIT = 1;
const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";

/** Generation owns its metadata, never an older copy of the interview evidence. */
async function patchGenerationInterview(projectId: string, actorId: string, expectedResetId: string | null, patch: (interview: any) => Record<string, unknown> | null) {
  await assertProjectWrite(actorId, projectId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const post = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true, updatedAt: true } });
    if (!post) return;
    const provenance = jsonObject(post.provenance);
    const interview = jsonObject(provenance.interview);
    if ((interview.resetId ?? null) !== expectedResetId) {
      throw Object.assign(new Error('The interview was restarted. Generate again using the new answers.'), { status: 409 });
    }
    const changes = patch(interview);
    if (!changes) return;
    const saved = await prisma.projectPost.updateMany({
      where: { projectId, updatedAt: post.updatedAt, provenance: { equals: post.provenance === null ? Prisma.DbNull : post.provenance } },
      data: { provenance: { ...provenance, interview: { ...interview, ...changes } } as Prisma.InputJsonValue },
    });
    if (saved.count === 1) return;
  }
  throw Object.assign(new Error('The interview changed while generation was saving. Retry from the saved interview.'), { status: 409 });
}

// Safe body reader that doesn't consume the stream
async function readJsonBody(req: Request) {
  try {
    // allow using both body and query string
    const url = new URL(req.url);
    const qpForce = url.searchParams.get('forceOverwriteDraft') === 'true';
    const clone = req.clone();
    const json = await clone.json().catch(() => ({}));
    return { ...json, forceOverwriteDraft: json?.forceOverwriteDraft ?? qpForce };
  } catch {
    return {};
  }
}

// Minimal sections shape for runtime validation (kept local to route)
const SectionSchema = z.object({
  type: z.enum(["narrative", "pullquote", "qa"]),
  heading: z.string().optional(),
  body: z.string().optional(),
  quote: z.string().optional(),
  qa: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
});

const SectionsSchema = z.array(SectionSchema).min(3).max(8);

const sentenceCap = (s?: string) => {
  if (!s) return s;
  const t = s.trim();
  if (!t) return t;
  // capitalize first letter, keep quotes verbatim elsewhere
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const cleanParagraph = (s?: string) => {
  if (!s) return s;
  // normalize whitespace, fix stray double spaces, keep actual quotes intact
  return sentenceCap(s.replace(/\s+/g, ' ').replace(/\s+([,.!?:;])/g, '$1'));
};

function groupImagesByRoom(images: Array<{ id: string; room?: string | null }>): Record<string, Array<{ id: string }>> {
  const byRoom: Record<string, Array<{ id: string }>> = {};
  
  for (const img of images) {
    const room = img.room || 'General';
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push({ id: img.id });
  }
  
  return byRoom;
}

function groupProductsByRoom(
  tags: Array<{ imageId: string; product: { id: string; name: string; vendor?: { name: string } | null } }>,
  images: Array<{ id: string; room?: string | null }>
): Record<string, Array<{ id: string; name: string; vendor?: string; imageId: string }>> {
  const imageRoomMap = new Map(images.map(img => [img.id, img.room || 'General']));
  const byRoom: Record<string, Array<{ id: string; name: string; vendor?: string; imageId: string }>> = {};
  
  for (const tag of tags) {
    const room = imageRoomMap.get(tag.imageId) || 'General';
    if (!byRoom[room]) byRoom[room] = [];
    
    const product = {
      id: tag.product.id,
      name: tag.product.name,
      vendor: tag.product.vendor?.name,
      imageId: tag.imageId,
    };
    
    // Avoid duplicates by product ID
    if (!byRoom[room].find(p => p.id === product.id)) {
      byRoom[room].push(product);
    }
  }
  
  return byRoom;
}

function verifyProductAccuracy(
  generatedText: string,
  taggedProducts: Array<{ name: string; vendor?: string }>,
  interviewText: string,
): { warnings: string[] } {
  const warnings: string[] = [];
  if (!generatedText || taggedProducts.length === 0) return { warnings };

  const textLower = generatedText.toLowerCase();
  const interviewLower = interviewText.toLowerCase();

  // Build sets of known product and vendor names
  const knownProducts = new Set(taggedProducts.map(p => p.name.toLowerCase()));
  const knownVendors = new Set(
    taggedProducts
      .map(p => p.vendor?.toLowerCase())
      .filter((v): v is string => !!v && v.length > 1)
  );

  // Check for vendor names in text that don't match tagged vendors
  // Extract capitalized multi-word proper nouns that could be vendor names
  const properNounPattern = /(?:by |from |(?:designed|crafted|made) by )((?:[A-Z][a-z]+(?:\s+(?:&\s+)?[A-Z][a-z]+)*))/g;
  let match;
  while ((match = properNounPattern.exec(generatedText)) !== null) {
    const candidate = match[1].trim();
    const candidateLower = candidate.toLowerCase();
    // Skip if it matches a known vendor or product
    if (knownVendors.has(candidateLower)) continue;
    if (knownProducts.has(candidateLower)) continue;
    // Skip if it appears in interview answers (designer mentioned it)
    if (interviewLower.includes(candidateLower)) continue;
    warnings.push(`Possible unverified vendor reference: "${candidate}" — not found in tag data or interview`);
  }

  // Check for material origin claims not backed by data
  const originPattern = /\b(Italian|French|Japanese|Scandinavian|Belgian|Danish|Swedish|German|English|British|Portuguese|Brazilian|Mexican|Moroccan|Indian|Chinese|Korean|Turkish|Greek|Spanish|Dutch|Swiss|Austrian|Norwegian|Finnish|Czech|Polish|Hungarian|Thai|Vietnamese|Indonesian|Filipino|Australian|Canadian|American)\b\s+\b(marble|leather|linen|silk|wool|oak|walnut|teak|ceramic|porcelain|tile|stone|granite|limestone|travertine|slate|brass|bronze|copper|steel|iron|glass|crystal|velvet|cotton|hemp|jute|rattan|bamboo|lacquer|plaster|concrete|terrazzo)\b/gi;
  while ((match = originPattern.exec(generatedText)) !== null) {
    const claim = match[0];
    const claimLower = claim.toLowerCase();
    // Check if this claim appears in interview answers or product data
    const inInterview = interviewLower.includes(claimLower);
    const inProducts = taggedProducts.some(p =>
      p.name.toLowerCase().includes(claimLower) ||
      (p.vendor?.toLowerCase().includes(match![1].toLowerCase()) ?? false)
    );
    if (!inInterview && !inProducts) {
      warnings.push(`Unverified material origin claim: "${claim}" — not found in interview answers or tag data`);
    }
  }

  return { warnings };
}

const ARRAY_FIELDS: string[] = [
  'galleryChapters',
  'pullQuotes',
  'method',
  'qa',
  'credits',
  // nested arrays:
  'galleryChapters.body',
  'galleryChapters.imageIds',
  // materials ledger
  'materialsLedger.items',
];

async function getTaggedSelections(projectId: string): Promise<{
  allSelections: string[];
  imageSelections: Record<string, string[]>;
}> {
  const tags = await prisma.productTag.findMany({
    where: {
      image: {
        projectId: projectId,
      },
    },
    include: {
      product: {
        include: {
          vendor: {
            select: {
              name: true,
              studio: true,
            },
          },
        },
      },
      image: {
        select: {
          id: true,
        },
      },
    },
  });

  const byImage = new Map<string, string[]>();
  const allSet = new Set<string>();

  for (const tag of tags) {
    const product = tag.product;
    const vendorName = product.vendor?.name || product.vendor?.studio;
    const label = vendorName ? `${product.name} | ${vendorName}` : product.name;
    
    const imageId = tag.image.id;
    const list = byImage.get(imageId) ?? [];
    list.push(label);
    byImage.set(imageId, list);
    
    allSet.add(label);
  }

  return {
    allSelections: Array.from(allSet),
    imageSelections: Object.fromEntries(byImage),
  };
}

// Build materials ledger from tags (matches BlocksSchema structure)
function buildMaterialsLedger(tags: any[]): { items: Array<{ name: string; finish?: string; note?: string; productId?: string; vendorId?: string }> } | undefined {
  const map = new Map<string, { name: string; vendor?: string; finish?: string; productId?: string; vendorId?: string; count: number }>();
  for (const t of tags || []) {
    const p = t?.product;
    if (!p?.id) continue;
    const key = p.id;
    const prev = map.get(key) || {
      name: p.name ?? "Product",
      vendor: p.vendor?.name,
      finish: p.finish || p.category,
      productId: p.id,
      vendorId: p.vendorId,
      count: 0,
    };
    prev.count += 1;
    map.set(key, prev);
  }
  const items = Array.from(map.values()).map(l => ({
    name: l.name,
    ...(l.finish && typeof l.finish === 'string' && l.finish.trim() ? { finish: l.finish.trim() } : {}),
    ...(l.vendor ? { note: `Vendor: ${l.vendor}`.slice(0, 140) } : {}),
    ...(l.productId ? { productId: l.productId } : {}),
    ...(l.vendorId ? { vendorId: l.vendorId } : {}),
  }));
  return items.length > 0 ? { items } : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const spotlightBoundary = await legacyInterviewBoundary(request);
  if (spotlightBoundary) return spotlightBoundary;

  const _cid = cid('generate');
  const projectId = params.projectId; // Extract early for catch block access
  let duration = 0;
  let authorizedActorId: string | null = null;
  let generationResetId: string | null | undefined;
  
  /* [AUDIT] START: log incoming projectId, lock status, and critical branches. */
  console.log("[AUDIT] generate:start", { projectId, _cid });
  const _dbg = (label: string, obj: any) => {
    try { 
      const str = JSON.stringify(obj, null, 2);
      console.log(`[AUDIT] ${label}:`, str.slice(0, 5000));
      if (str.length > 5000) {
        console.log(`[AUDIT] ${label} (truncated, total length: ${str.length})`);
      }
    } catch (e) { 
      console.log(`[AUDIT] ${label} (circular or non-serializable)`, String(e));
    }
  };
  
  try {
    if (!POSTING_V1_ENABLED) {
      return NextResponse.json(
        { error: "posting_disabled" },
        { status: 404 }
      );
    }

    // Read body first (safe reader that doesn't consume stream)
    const body = await readJsonBody(request);
    const forceOverwriteDraft = Boolean(body.forceOverwriteDraft);
    const debugEcho = Boolean(body.debugEcho);
    const callSource = body?.source || request.headers.get("x-debug-client") || "unknown";
    const force = Boolean(body.force);
    const answersOverride = Array.isArray(body.answersOverride) ? await stripPrivateInterviewData(body.answersOverride) : undefined;
    const followupsOverride = Array.isArray(body.followupsOverride) ? body.followupsOverride : undefined;
    // The Room IDs the client expects to be written up. ADVISORY ONLY — the
    // server decides eligibility for itself from the canonical provenance answer
    // counts below, and this list exists so a client/server disagreement shows up
    // in the logs instead of silently producing an article the UI didn't promise.
    // `completedRoomIds` is the old name for the same field, kept so a client
    // deployed a moment earlier still gets its expectation logged.
    const rawWriteUpIds = Array.isArray(body.writeUpRoomIds)
      ? body.writeUpRoomIds
      : Array.isArray(body.completedRoomIds)
        ? body.completedRoomIds
        : undefined;
    const clientWriteUpRoomIds = rawWriteUpIds
      ? (rawWriteUpIds as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined;

    // Editorial context toggles (default: include everything available)
    const includeBio = body.includeBio !== false;
    const includeProjectHistory = body.includeProjectHistory !== false;

    // Always use recomposition mode (hard-fail editorial)
    const mode = 'recomposition' as const;

    console.log("[AUDIT] generate:entry", {
      projectId,
      forceOverwriteDraft,
      source: callSource,
      debugEcho,
      mode,
      overrides: {
        answers: Array.isArray(answersOverride) ? answersOverride.length : 0,
        followups: Array.isArray(followupsOverride) ? followupsOverride.length : 0,
      },
      _cid,
    });

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
      authorizedActorId = session.user.id;
    } catch (e: any) {
      if (e.message === "NotFound") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limiting
    // Always apply user-level daily limit
    const rl1 = await rateLimit({
      userId: session.user.id,
      scope: "draft:user:day",
      limit: USER_DAILY_LIMIT,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!rl1.ok) {
      return NextResponse.json(
        { error: "rate_limited_user", resetAt: rl1.resetAt },
        { status: 429 }
      );
    }

    // Skip project-level rate limit when force=true (explicit overwrite)
    // This allows immediate retry after 409 conflict
    if (!force) {
      const rl2 = await rateLimit({
        userId: projectId,
        scope: "draft:project:minute",
        limit: PROJECT_MINUTE_LIMIT,
        windowMs: 60 * 1000,
      });
      if (!rl2.ok) {
        return NextResponse.json(
          { error: "rate_limited_project", resetAt: rl2.resetAt },
          { status: 429 }
        );
      }
    }

    // Fetch project with all needed data
    const projectData = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            studio: true,
            bio: true,
          },
        },
        // Org that owns this project (set at creation when the poster operates as
        // an org). When present, the article is CREDITED to the org — the person
        // stays the quoted voice. See genInput.org below.
        designerOrg: {
          select: {
            id: true,
            name: true,
            // The org's own bio. On an org-owned project the article is credited
            // to the FIRM, but "Include my bio" only ever reached the individual
            // User.bio — so a studio that wrote a full org bio had it ignored,
            // and a principal with an empty personal bio contributed nothing at
            // all. See the bio assembly below.
            bioInterview: {
              select: { fullBio: true, shortBio: true, philosophyStatement: true },
            },
          },
        },
        images: {
          include: {
            tags: {
              include: {
                product: {
                  include: {
                    vendor: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!projectData) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Fetch rooms for room-answer mapping (used by bridge and room coverage)
    const projectRooms = await prisma.room.findMany({
      where: { projectId },
      select: { id: true, name: true },
    });
    const roomIdToName = new Map(projectRooms.map(r => [r.id, r.name]));
    // ONE resolver for everything that needs to name a room — interview answers
    // here, gallery images further down. Chapter titles are derived from the
    // image side and pull quotes are looked up by the answer side, so the two
    // must resolve a room identically or the lookup misses. Sharing the closure
    // is what makes that structural rather than a convention.
    const resolveRoomName = buildRoomResolver(projectRooms);

    // Fetch or create post
    let post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: {
        id: true,
        projectId: true,
        status: true,
        expandedBlocks: true,
        provenance: true,
        slug: true,
        heroAssetId: true,
        excerpt: true,
        credits: true,
        sectionOverrides: true,
        sectionHistory: true,
      },
    });

    // Every later metadata/final write belongs to this interview incarnation.
    // A restart must also invalidate legacy generation, which has no guided ID.
    generationResetId = ((post?.provenance as any)?.interview?.resetId ?? null) as string | null;
    if ((Array.isArray(body.answersOverride) || Array.isArray(body.followupsOverride)) && (body.resetId ?? null) !== generationResetId) {
      return NextResponse.json({ ok: false, code: 'INTERVIEW_RESET', error: 'This interview was started over. Reload before preparing a draft from your answers.' }, { status: 409 });
    }

    // Check for existing draft and respect forceOverwriteDraft flag
    if (post?.status === 'REVIEW' || post?.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'Return the post to draft before regenerating' }, { status: 409 });
    }
    if (post?.status === 'PUBLISHED' || projectData.isPublic) await assertProjectPublish(session.user.id, projectId);
    const draftExists = post && post.status === "DRAFT" && post.expandedBlocks;
    if (draftExists && !forceOverwriteDraft && !debugEcho) {
      console.log('[AUDIT] lock:return-202 (draft exists & no force)');
      return NextResponse.json({ status: 'already_has_draft' }, { status: 202 });
    }

    // Recomposition permits replacing a draft, never bypassing an active writer.
    const acquireLock = !debugEcho;

    // Expiry covers the route runtime; a replacement also fences late results.
    if (acquireLock) {
      const existingLock = (post?.provenance as any)?.interview?.status;
      if (existingLock?.phase === 'generating') {
        const age = Date.now() - (existingLock.startedAt ?? 0);
        if (age < (maxDuration + 30) * 1000) {
          // The prior writer may still be running; return 202 (in progress)
          console.log("[AUDIT] generate:lock:return-202", { projectId, ageMs: age, reason: "fresh-lock", _cid });
          return NextResponse.json(
            { 
              status: "in-progress",
              message: "Generation is already in progress. Please wait." 
            },
            { status: 202 }
          );
        } else {
          // The prior runtime has expired; acquisition will replace its lease.
          console.log("[AUDIT] generate:stale-lock", { projectId, ageMs: age, _cid });
          console.warn("[posting/interview/generate] Releasing stale generation lock", { _cid, age });
          // Replace an expired lease only in the atomic acquisition below.
          // IMPORTANT: do NOT return here — proceed to set a fresh lock
        }
      }
    } else if (debugEcho) {
      console.log("[AUDIT] generate:debug:skip-lock", { projectId, _cid });
    }

    // Always allow overwriting existing drafts - no need to check for existing draft
    // The lock check above handles concurrent generation attempts

    if (!post) {
      const { makeSlug } = await import("@/lib/posting/slug");
      const slug = makeSlug(projectData.title || undefined, projectId);
      post = await prisma.projectPost.create({
        data: {
          projectId,
          slug,
          status: "DRAFT",
        },
        select: {
          id: true,
          projectId: true,
          status: true,
          expandedBlocks: true,
          provenance: true,
          slug: true,
          heroAssetId: true,
          excerpt: true,
          credits: true,
          sectionOverrides: true,
          sectionHistory: true,
        },
      });
    }

    // Get interview data from provenance
    // If force=true, retry fetching the post in case of recent saves
    let provenance = (await stripPrivateInterviewData(post.provenance) as any) || {};
    let interview = provenance.interview || {};

    // If force=true and no answers found (and no overrides), wait a bit and refetch (handles race condition)
    const hasOverrideAnswers = Array.isArray(answersOverride) && answersOverride.length > 0;
    if (force && !hasOverrideAnswers && (!interview || !interview.payload?.answers || interview.payload.answers.length === 0)) {
      console.warn("[posting/interview/generate] No answers found on force retry, waiting and refetching...", { _cid });
      await new Promise(resolve => setTimeout(resolve, 1000));

      const refreshedPost = await prisma.projectPost.findUnique({
        where: { projectId },
        select: { provenance: true },
      });

      if (refreshedPost) {
        if (((refreshedPost.provenance as any)?.interview?.resetId ?? null) !== generationResetId) {
          throw Object.assign(new Error('The interview was restarted. Generate again using the new answers.'), { status: 409 });
        }
        provenance = (await stripPrivateInterviewData(refreshedPost.provenance) as any) || {};
        interview = provenance.interview || {};
      }
    }

    // Bridge: If no answers in provenance, check EditorialInterviewAnswer table
    // (The new InterviewFlow writes to EditorialInterviewAnswer, not provenance)
    const provenanceAnswerCount = interview?.payload?.answers?.length || 0;
    if (!hasOverrideAnswers && provenanceAnswerCount === 0) {
      console.log("[posting/interview/generate] No provenance answers, checking EditorialInterviewAnswer table...", { _cid });

      try {
        const editorialInterview = await prisma.editorialInterview.findUnique({
          where: { projectId },
          include: {
            answers: {
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (editorialInterview && editorialInterview.answers.length > 0) {
          const dbAnswers = (await stripPrivateInterviewData(editorialInterview.answers)).map((a) => ({
            questionId: a.questionId,
            prompt: a.questionText || a.questionId,
            answer: a.answerText,
            role: "DESIGNER",
            isFollowUp: a.isFollowUp,
            section: a.questionSource || "base_question",
            roomName: a.roomId ? roomIdToName.get(a.roomId) || undefined : undefined,
          }));

          const baseDbAnswers = dbAnswers.filter((a) => !a.isFollowUp);
          const followUpDbAnswers = dbAnswers.filter((a) => a.isFollowUp);

          console.log("[posting/interview/generate] Found answers in EditorialInterviewAnswer table", {
            _cid,
            total: dbAnswers.length,
            base: baseDbAnswers.length,
            followUps: followUpDbAnswers.length,
          });

          // Populate interview structure so the rest of the handler works
          if (!interview) interview = {};
          if (!interview.payload) interview.payload = {};
          interview.payload.answers = baseDbAnswers;
          interview.payload.followups = followUpDbAnswers;
          // Use project images as imageOrder if not set
          if (!interview.payload.imageOrder) {
            interview.payload.imageOrder = projectData.images.map((img) => img.id);
          }
        }
      } catch (bridgeErr: any) {
        console.warn("[posting/interview/generate] EditorialInterviewAnswer bridge failed:", bridgeErr?.message, { _cid });
      }
    }

    console.log("[posting/interview/generate] Interview data:", {
      _cid,
      hasInterview: !!interview,
      hasPayload: !!interview?.payload,
      hasAnswers: !!interview?.payload?.answers,
      answerCount: interview?.payload?.answers?.length || 0,
      interviewKeys: interview ? Object.keys(interview) : [],
      payloadKeys: interview?.payload ? Object.keys(interview.payload) : [],
      force,
    });

    // Try to recover answers from alternative provenance paths before giving up
    if (!hasOverrideAnswers && (!interview || !interview.payload?.answers || interview.payload.answers.length === 0)) {
      // Check legacy mirror path: interview.answers (set by POST /interview endpoint)
      const legacyAnswers = interview?.answers;
      if (Array.isArray(legacyAnswers) && legacyAnswers.length > 0) {
        console.warn("[posting/interview/generate] Recovered answers from legacy mirror (interview.answers)", {
          _cid, count: legacyAnswers.length,
        });
        // Inject into interview.payload so downstream code finds them
        if (!interview.payload) interview.payload = {};
        interview.payload.answers = legacyAnswers;
      } else {
        // Last-resort: re-read provenance one more time (handles write-lag from eventual consistency)
        const lastResortPost = await prisma.projectPost.findUnique({
          where: { projectId },
          select: { provenance: true },
        });
        const lastResortProv = (await stripPrivateInterviewData(lastResortPost?.provenance) as any) || {};
        const lastResortInterview = lastResortProv.interview || {};
        if ((lastResortInterview.resetId ?? null) !== generationResetId) {
          throw Object.assign(new Error('The interview was restarted. Generate again using the new answers.'), { status: 409 });
        }
        const lastResortAnswers = lastResortInterview.payload?.answers || lastResortInterview.answers || [];

        if (Array.isArray(lastResortAnswers) && lastResortAnswers.length > 0) {
          console.warn("[posting/interview/generate] Recovered answers from last-resort DB re-read", {
            _cid, count: lastResortAnswers.length,
          });
          provenance = lastResortProv;
          interview = lastResortInterview;
          if (!interview.payload) interview.payload = {};
          interview.payload.answers = lastResortAnswers;
        } else {
          console.error("[posting/interview/generate] Missing interview data after all recovery attempts:", {
            _cid,
            interview: !!interview,
            payload: !!interview?.payload,
            payloadAnswers: interview?.payload?.answers?.length ?? 0,
            legacyAnswers: interview?.answers?.length ?? 0,
            provenanceKeys: Object.keys(provenance),
            interviewKeys: interview ? Object.keys(interview) : [],
            hasOverrideAnswers,
          });
          return NextResponse.json(
            { error: "No interview answers found. Please complete the interview first.", code: "NO_ANSWERS" },
            { status: 400 }
          );
        }
      }
    }

    // Extract vendors from product tags
    const vendors = Array.from(
      new Set(
        projectData.images
          .flatMap((img) => img.tags.map((tag) => tag.product.vendorId))
          .filter(Boolean)
      )
    ).map((vendorId) => ({ id: vendorId, name: "Vendor" })); // Simplified; enhance if vendor data available

    const started = Date.now();
    const aiAvailable = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";
    const provider = aiAvailable ? "anthropic" : "fallback";

    // Get follow-ups count from interview data
    // Structure: interview.followUps is Array<{ questionId: string, followUps: Array<{ id, prompt }> }>
    let followupsCount = 0;
    const followups = interview.followUps;
    if (Array.isArray(followups)) {
      followupsCount = followups.reduce((acc, group: any) => {
        return acc + (Array.isArray(group.followUps) ? group.followUps.length : 0);
      }, 0);
    } else if (typeof followups === 'number') {
      followupsCount = followups;
    }

    // Acquire against the current provenance, so simultaneous requests cannot both win.
    if (acquireLock) {
      await patchGenerationInterview(projectId, session.user.id, generationResetId, current => {
        if (current.status?.phase === 'generating' && Date.now() - (current.status.startedAt ?? 0) < (maxDuration + 30) * 1000) {
          throw Object.assign(new Error('Generation is already in progress. Check the saved draft before retrying.'), { status: 409 });
        }
        return { status: { phase: 'generating', startedAt: Date.now(), requestId: _cid } };
      });
    }

    // Use overrides if provided, otherwise use interview data
    const baseAnswers = await stripPrivateInterviewData(answersOverride ?? interview.payload.answers ?? []);
    const baseFollowups = await stripPrivateInterviewData(followupsOverride ?? interview.followUps ?? interview.followups ?? []);
    
    console.log("[AUDIT] generate:inputs", {
      answersLen: Array.isArray(baseAnswers) ? baseAnswers.length : 0,
      followupsLen: Array.isArray(baseFollowups) ? baseFollowups.length : 0,
      usingOverrides: {
        answers: !!answersOverride,
        followups: !!followupsOverride,
      },
      _cid,
    });

    // Ensure answers is an array and imageOrder is an array or undefined
    const rawAnswers = baseAnswers;
    const answers = Array.isArray(rawAnswers) 
      ? rawAnswers 
      : (rawAnswers && typeof rawAnswers === 'object' ? Object.values(rawAnswers) : []);
    const imageOrder = Array.isArray(interview.payload.imageOrder)
      ? interview.payload.imageOrder
      : undefined;

    // Log the structure for debugging
    if (!Array.isArray(rawAnswers)) {
      console.warn("[posting/interview/generate] Answers is not an array, attempting to convert", {
        _cid,
        rawAnswersType: typeof rawAnswers,
        isArray: Array.isArray(rawAnswers),
        rawAnswersKeys: rawAnswers && typeof rawAnswers === 'object' ? Object.keys(rawAnswers) : null,
        convertedLength: answers.length,
      });
    }

    if (answers.length === 0) {
      console.error("[posting/interview/generate] Answers array is empty after validation", {
        _cid,
        payloadAnswers: interview.payload.answers,
        payloadAnswersType: typeof interview.payload.answers,
        isArray: Array.isArray(interview.payload.answers),
        convertedAnswers: answers,
      });
      return NextResponse.json(
        { error: "No interview answers found. Please complete the interview first." },
        { status: 400 }
      );
    }

    // Extract follow-ups answers from interview payload (use override if provided)
    const followupsAnswers = baseFollowups.length > 0
      ? baseFollowups
      : (Array.isArray(interview.payload.followups) ? interview.payload.followups : []);
    
    // Build follow-ups array for narrative composer
    // Preserve original questionId so downstream filters (e.g. spliceHookQuote's
    // `hook-followup-` startsWith check) can identify hook follow-up answers.
    const followupsArray = followupsAnswers.map((a: any) => ({
      questionId: a.questionId || a.id,
      question: a.question || a.prompt || a.q || '',
      answer: a.answer || a.a || '',
      // Room attribution and the follow-up flag have to survive this hop.
      // Dropping either silently degrades pull quotes: without the room the
      // answer cannot be matched to a chapter, and without the flag
      // `extractQuoteCandidates` stops ranking follow-ups above primaries —
      // which is the whole reason follow-up questions are prompted for quotable
      // material. (The follow-up tier is the SECOND sort key; self-sufficiency
      // is the first. Losing the flag still costs the tier.)
      roomId: a.roomId ?? a.room_id ?? null,
      roomName: a.roomName || undefined,
      isFollowUp: true,
    })).filter((f: { question: string; answer: string }) => f.question && f.answer);

    // Extract tagged products from images
    const images = projectData.images || [];
    const allTags = images.flatMap((img) => img.tags || []);

    // Build materials ledger from tags
    const materialsLedger = buildMaterialsLedger(allTags);

    // Get tagged selections for the project
    const { allSelections, imageSelections } = await getTaggedSelections(projectId);

    // Ensure we have imageOrder - fallback to project images if not in interview payload
    let finalImageOrder = imageOrder;
    if (!finalImageOrder || finalImageOrder.length === 0) {
      // Fallback: use project images if no imageOrder in interview payload
      finalImageOrder = images.map(img => img.id).filter(Boolean);
      console.log('[AUDIT] generate: using project images as imageOrder fallback', { 
        count: finalImageOrder.length, 
        _cid 
      });
    }

    // Validate imageOrder has at least one valid UUID
    const uuidPatternValidate = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validImageIds = (finalImageOrder || []).filter((id: string) => 
      id && typeof id === 'string' && uuidPatternValidate.test(id)
    );

    if (validImageIds.length === 0) {
      console.error('[AUDIT] generate: no valid image IDs found', { 
        imageOrder: finalImageOrder?.length || 0,
        images: images.length,
        _cid 
      });
      return NextResponse.json(
        { error: "No valid image IDs found. Please add images to the project first." },
        { status: 400 }
      );
    }

    // Normalize answers and followups for composition
    // - `questionId` preserves the original opaque id (e.g. `hook-opener-…`) so
    //   spliceHookQuote can identify the hook-anchor pair.
    // - `q` carries the human-readable question text used as a label in the LLM
    //   prompt (mapped to `questionText` on GenInput).
    // Preserve roomName so the prompt can group answers by room.
    // Which room an answer is about. Answers persist `roomId` as first-class
    // (D5) and do NOT carry a room NAME — `section` on a stored answer is the
    // question category ("what"/"how"/"why"), never a room. Only the
    // EditorialInterviewAnswer bridge above resolved the id, and that path runs
    // only when provenance holds no answers at all.
    //
    // So on the normal path every answer arrived here with `roomName`
    // undefined, became `section: 'General'` on GenInput, and
    // `assignVerifiedPullQuotes` keyed its selections under the single room
    // "General" — which is not the title of any chapter. Every lookup missed and
    // every chapter had its pull quote CLEARED. That is why a fully answered
    // project can generate with zero pull quotes.
    // An answer resolves like an image does: authoritative roomId first, then a
    // denormalized name, never a guess.
    const answerRoom = (a: any): string | undefined =>
      resolveRoomName({ roomId: a?.roomId ?? a?.room_id ?? null, room: a?.roomName ?? null }) ?? undefined;

    const normalizedAnswers = answers.map((a: any) => ({
      questionId: a.questionId,
      q: a.prompt || a.questionText || a.questionId || 'Question',
      a: a.answer || '',
      roomName: answerRoom(a),
      isFollowUp: a.isFollowUp || false,
    })).filter((x: { q: string; a: string }) => x.a.trim());

    const normalizedFollowUps = followupsArray.map((f: any) => ({
      questionId: f.questionId,
      q: f.question || f.prompt || 'Follow-up',
      a: f.answer || '',
      roomName: answerRoom(f),
      isFollowUp: true,
    })).filter((x: { q: string; a: string }) => x.a.trim());

    // Debug: log room names as they'll appear in the generation prompt
    console.log('[ROOM DEBUG] Rooms formatted for generation prompt:', {
      answerRoomNames: [...new Set(normalizedAnswers.map((a: any) => a.roomName).filter(Boolean))],
      followupRoomNames: [...new Set(normalizedFollowUps.map((f: any) => f.roomName).filter(Boolean))],
      imageRooms: [...new Set(images.map((img: any) => img.room).filter(Boolean))],
      _cid,
    });

    // Compose editorial blocks using AI (HARD-FAIL: no fallbacks)
    // Prepare images with room data for room-based organization
    const validImages = images.filter(img => validImageIds.includes(img.id));

    // Resolve each image to a CURRENT Room, FK-first. ProjectImage carries both a
    // real `roomId` (authoritative) and a denormalized `room` string that goes
    // stale after renames/merges and is written in three different shapes (type,
    // label, or UUID) by different pipelines. buildRoomResolver prefers the FK,
    // then matches the string by name/UUID, and otherwise keeps the raw value —
    // it NEVER pairs a leftover image-room to a leftover Room name by position.
    // The old by-elimination pairing did exactly that and could file a bathroom
    // photo under a "Stairway" heading. This is the single generation path, so
    // every surface that renders a draft resolves rooms identically.
    const currentRoomNames = projectRooms.map(r => r.name);

    const imagesWithRoomData = validImages.map(img => ({
      id: img.id,
      room: resolveRoomName(img),
      tags: img.tags || [],
    }));

    // Log room organization for debugging
    const flatTags = validImages.flatMap(img => 
      (img.tags || []).map(tag => ({
        imageId: img.id,
        product: tag.product,
      }))
    );
    const imagesByRoom = groupImagesByRoom(validImages);
    const productsByRoom = groupProductsByRoom(flatTags, validImages);

    console.log('[ROOM ORGANIZATION]', {
      projectId,
      rooms: Object.keys(imagesByRoom),
      roomDetails: Object.entries(imagesByRoom).map(([room, imgs]) => ({
        room,
        imageCount: imgs.length,
        products: productsByRoom[room]?.length || 0,
        productNames: productsByRoom[room]?.slice(0, 3).map((p: any) => p.name) || [],
      })),
      totalImages: validImages.length,
      totalProducts: flatTags.length,
      _cid,
    });

    // Fetch designer context for editorial generation — all optional, never block generation
    let designerName: string | undefined;
    let designerBio: string | undefined;
    let projectLocation: string | undefined;
    try {
      designerName = projectData.designer?.name || undefined;
      // Same rule the checkbox was offered under — see generationContext.ts.
      // Two copies of "which bio wins" is how the offer and the run drift apart.
      designerBio = includeBio
        ? resolveDesignerBio({
            orgBio: projectData.designerOrg?.bioInterview,
            designerBio: projectData.designer?.bio,
          })?.text
        : undefined;
      projectLocation = [projectData.city, projectData.regionState].filter(Boolean).join(', ') || undefined;
    } catch (ctxErr: any) {
      console.warn('[generate] Designer context fetch failed (non-fatal):', ctxErr?.message, { _cid });
    }

    // Fetch designer's other published projects for context
    let projectHistory: string | undefined;
    if (includeProjectHistory && projectData.designerId) {
      try {
        // Same rule the checkbox was offered under — see generationContext.ts.
        const otherProjects = await prisma.project.findMany({
          where: siblingProjectsWhere({
            projectId,
            designerId: projectData.designerId,
            orgId: projectData.designerOrg?.id ?? null,
          }),
          select: {
            title: true,
            city: true,
            regionState: true,
            images: {
              select: {
                room: true,
                tags: {
                  select: { product: { select: { name: true } } },
                  take: 3,
                },
              },
              take: 10,
            },
          },
          orderBy: { publishedAt: 'desc' },
          take: 5,
        });
        if (otherProjects.length > 0) {
          projectHistory = otherProjects.map(p => {
            const rooms = [...new Set(p.images.map(img => img.room).filter(Boolean))];
            const topProducts = [...new Set(p.images.flatMap(img => img.tags.map(t => t.product.name)))].slice(0, 3);
            const location = [p.city, p.regionState].filter(Boolean).join(', ');
            return `- ${p.title}${location ? ` (${location})` : ''} — rooms: ${rooms.length > 0 ? rooms.join(', ') : 'N/A'}, materials: ${topProducts.length > 0 ? topProducts.join(', ') : 'N/A'}`;
          }).join('\n');
        }
      } catch (historyErr: any) {
        console.warn('[generate] Project history fetch failed (non-fatal):', historyErr?.message, { _cid });
      }
    }

    // Fetch Atelier fingerprint summary if available.
    //
    // Gated by includeBio: this is the designer's voice and philosophy, drawn
    // from their Folio profile, and it enters the prompt beside the bio under
    // "Designer Voice & Philosophy". It used to ignore the checkbox entirely, so
    // unchecking "Include my bio" still sent profile-derived voice data — the
    // box said one thing and the prompt did another.
    let atelierSummary: string | undefined;
    if (includeBio && projectData.designerId) {
      try {
        const fingerprint = await prisma.atelierFingerprint.findFirst({
          where: { designerId: projectData.designerId, ownerType: 'DESIGNER' },
          include: {
            nodes: {
              orderBy: { weight: 'desc' },
              take: 10,
            },
          },
        });
        if (fingerprint && fingerprint.nodes.length > 0) {
          const grouped: Record<string, string[]> = {};
          for (const node of fingerprint.nodes) {
            const type = node.nodeType.toLowerCase().replace('_', ' ');
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(node.label);
          }
          atelierSummary = Object.entries(grouped)
            .map(([type, labels]) => `${type}: ${labels.join(', ')}`)
            .join('\n');
        }
      } catch (fingerprintErr: any) {
        console.warn('[generate] Atelier fingerprint fetch failed (non-fatal):', fingerprintErr?.message, { _cid });
      }
    }

    // Build room-answer counts from interview answers (for room coverage enforcement)
    const roomsWithAnswers = new Map<string, number>();
    for (const a of answers) {
      const roomName = (a as any).roomName;
      if (roomName) {
        roomsWithAnswers.set(roomName, (roomsWithAnswers.get(roomName) || 0) + 1);
      }
    }
    if (roomsWithAnswers.size > 0) {
      console.log('[ROOM COVERAGE] Rooms with interview answers:', {
        rooms: Object.fromEntries(roomsWithAnswers),
        _cid,
      });
    }

    // --- Append-only eligibility (C2/C3) — replaces the old ROOM QUALITY GATE ---
    // Images are NEVER withheld now. Every real room with photos yields a chapter;
    // this split only decides its KIND. A room earns an EDITORIAL chapter only
    // when the server says it's finalized (roomProgress status 'complete') AND it
    // has at least one recorded answer (grounded in the answer rows we loaded,
    // not the client tally). Everything else — skipped, in-progress, not-started,
    // complete-but-empty — gets a photo-only GALLERY chapter. Published editorial
    // chapters are frozen and never rewritten.
    const gatedImages = imagesWithRoomData;
    const gatedValidImageIds = validImageIds;
    const gatedKeptIds = new Set(gatedImages.map(i => i.id));

    // Server room status — authoritative for finalized-vs-in-progress (C0 taught
    // the server 'complete'). Missing/failed load ⇒ treat all rooms as unfinalized.
    let serverRoomProgress: Record<string, any> = {};
    try {
      const ei = await prisma.editorialInterview.findUnique({
        where: { projectId },
        select: { roomProgress: true },
      });
      serverRoomProgress = (ei?.roomProgress && typeof ei.roomProgress === 'object')
        ? (ei.roomProgress as Record<string, any>)
        : {};
    } catch (e: any) {
      console.warn('[generate] roomProgress load failed — treating all rooms as unfinalized', { _cid, error: e?.message });
    }

    // REGENERATE PRESERVES NOTHING.
    //
    // This filter used to freeze every existing editorial chapter with a roomId
    // — its comment claimed "published", but it never checked publication, and
    // `post.status` sits unread a few lines above. So a draft that had been
    // generated once could never be regenerated: every click rewrote the lead
    // and introduction and froze the rest verbatim. Room prose paired to the
    // wrong room, and titles written before formatRoomName existed, survived
    // every regeneration with no way for a designer to repair them.
    //
    // Regenerate now means regenerate. Preserving specific chapters is a real
    // feature — per-room opt-in, and it should be the designer's explicit
    // choice — but it is a separate one, so the machinery below is left intact
    // rather than deleted.
    const existingChapters: any[] = Array.isArray((post?.expandedBlocks as any)?.galleryChapters)
      ? (post!.expandedBlocks as any).galleryChapters
      : [];
    const frozenChapters: any[] = [];
    void existingChapters;
    const frozenRoomIds = new Set<string>(frozenChapters.map((ch) => ch.roomId));

    // Only rooms with at least one image can form a chapter.
    const roomsWithImages = new Set(
      imagesWithRoomData.map((img) => img.room).filter((n): n is string => !!n && currentRoomNames.includes(n)),
    );

    // D2: answer counts grouped by roomId, read from the CANONICAL provenance
    // payload. The read/record split (D5b): provenance.interview.payload.answers
    // is canonical and atomic — anything that DECIDES reads it. EditorialInterviewAnswer
    // is a queryable projection; nothing decides on it. Eligibility is a decision,
    // so it counts provenance rows, not projection rows, and keys strictly by
    // roomId. We do NOT join roomProgress (keyed by roomId) against roomsWithAnswers
    // (keyed by NAME): answersOverride carries no roomName, so that map is empty on
    // the modal path and every room would wrongly fall to gallery. Names are for the
    // prompt and image mapping — downstream of this decision, never an input to it.
    const provenanceAnswers: any[] = Array.isArray(interview?.payload?.answers)
      ? interview.payload.answers
      : [];
    const answerCountsByRoomId = new Map<string, number>();
    for (const a of provenanceAnswers) {
      const rid = (a as any).roomId;
      if (!rid) continue; // project-level answers (roomId null) map to no room chapter
      answerCountsByRoomId.set(rid, (answerCountsByRoomId.get(rid) || 0) + 1);
    }

    // Split real rooms into new-editorial vs gallery; log client/server disagreement.
    const writeRoomNames: string[] = [];
    const galleryRoomNames: string[] = [];
    const roomNameToId: Record<string, string> = {};
    const clientWriteUpIds = new Set(clientWriteUpRoomIds ?? []);
    const disagreements: Array<{ roomId: string; roomName: string; serverStatus: string; answers: number; clientExpectedWriteUp: boolean }> = [];
    for (const r of projectRooms) {
      roomNameToId[r.name] = r.id;
      if (!roomsWithImages.has(r.name)) continue; // no images → no chapter at all
      // D2: eligibility joins by roomId only (never name).
      const answerCount = answerCountsByRoomId.get(r.id) ?? 0;
      const answered = answerCount > 0;
      if (clientWriteUpRoomIds && clientWriteUpIds.has(r.id) !== answered) {
        disagreements.push({
          roomId: r.id,
          roomName: r.name,
          serverStatus: serverRoomProgress[r.id]?.status ?? 'not_started',
          answers: answerCount,
          clientExpectedWriteUp: clientWriteUpIds.has(r.id),
        });
      }
      if (frozenRoomIds.has(r.id)) continue; // already published → frozen; no new chapter, no gallery
      // ANYTHING THE DESIGNER SAID GETS WRITTEN UP.
      //
      // This used to also require roomProgress.status === 'complete', which cost
      // designers their own words twice over. First by design: a room answered
      // 2-of-3 was demoted to photos-only, so the thing they had actually said
      // about it never reached the article. Second by accident: `status` comes
      // from EditorialInterview.roomProgress — a separate record, loaded above
      // behind a try/catch, and frequently null or stale — so a room the
      // designer genuinely finished was ALSO dropped whenever that record hadn't
      // kept up. A failed load meant every room fell to gallery and the article
      // had no chapters at all.
      //
      // The answer count is read from provenance, which is written in the same
      // atomic update as the answers themselves. It cannot disagree with what
      // the designer typed. A partly answered room simply produces a shorter
      // chapter, and the Story tab warns before generating that it will.
      //
      // 'skipped' is deliberately NOT an exception. Skip means "stop asking me
      // about this room", not "throw away what I already said" — and a room
      // skipped with nothing said has no answers, so it lands in the gallery on
      // this rule anyway.
      if (answered) writeRoomNames.push(r.name);
      else galleryRoomNames.push(r.name);
    }
    if (disagreements.length > 0) {
      console.warn('[generate] client write-up expectation vs server answer counts', { _cid, disagreements });
    }

    const composeMode: 'initial' | 'append' = frozenChapters.length > 0 ? 'append' : 'initial';
    const passGeneratedAt = Date.now();

    // Frozen lead/intro from preserved -1/-2 overrides (Q1): reproduced verbatim,
    // passed as fixed context so the model never regenerates an edited field.
    const existingOverrides: any[] = Array.isArray(post?.sectionOverrides) ? (post!.sectionOverrides as any[]) : [];
    const existingHistory: any[] = Array.isArray(post?.sectionHistory) ? (post!.sectionHistory as any[]) : [];
    const frozenLead: { kicker?: string; deck?: string } = {};
    for (const o of existingOverrides) {
      if (o?.chapterIndex === -1 && (o.field === 'kicker' || o.field === 'deck') && typeof o.editedBody === 'string') {
        frozenLead[o.field as 'kicker' | 'deck'] = o.editedBody;
      }
    }
    let frozenIntroduction: string[] | undefined;
    const introOverrides = existingOverrides.filter((o) => o?.chapterIndex === -2 && o.field === 'introduction');
    if (introOverrides.length > 0) {
      const introArr: string[] = Array.isArray((post?.expandedBlocks as any)?.introduction)
        ? [...(post!.expandedBlocks as any).introduction]
        : [];
      for (const o of introOverrides) {
        if (typeof o.paragraphIndex === 'number' && typeof o.editedBody === 'string') introArr[o.paragraphIndex] = o.editedBody;
      }
      const cleaned = introArr.filter((p) => typeof p === 'string' && p.trim());
      if (cleaned.length > 0) frozenIntroduction = cleaned;
    }

    // excludedRooms for the Story-tab notice = the rooms that became gallery this pass.
    const excludedRooms: Array<{ roomName: string; imageCount: number }> = galleryRoomNames.map((name) => ({
      roomName: name,
      imageCount: imagesWithRoomData.filter((img) => img.room === name).length,
    }));

    console.log('[generate] append-only split', {
      _cid, mode: composeMode, frozen: frozenChapters.length,
      writeRooms: writeRoomNames, galleryRooms: galleryRoomNames,
    });

    // --- Normalize inputs to GenInput for the unified generateEditorialDraft ---
    const genInput: GenInput = {
      project: {
        id: projectId,
        title: projectData.title || 'Project',
        description: projectData.description,
        city: projectData.city,
        regionState: projectData.regionState,
        projectType: projectData.projectType,
        clientType: projectData.clientType,
      },
      designer: projectData.designer ? {
        id: projectData.designer.id,
        name: designerName || projectData.designer.name || 'Designer',
        studio: projectData.designer.studio,
      } : undefined,
      // Org attribution: when the project is org-owned, credits/byline become the
      // org while the interviewee stays the quoted voice (see generateEditorialDraft).
      org: projectData.designerOrg ? {
        id: projectData.designerOrg.id,
        name: projectData.designerOrg.name,
      } : null,
      images: gatedImages.map(img => ({
        id: img.id,
        room: img.room || undefined,
      })),
      tags: validImages.filter(img => gatedKeptIds.has(img.id)).flatMap(img =>
        (img.tags || []).map((tag: any) => ({
          id: tag.id,
          imageId: img.id,
          productId: tag.productId,
          product: tag.product ? {
            id: tag.product.id,
            name: tag.product.name,
            vendor: tag.product.vendor ? {
              id: tag.product.vendor.id,
              name: tag.product.vendor.name || tag.product.vendor.companyName || 'Vendor',
            } : undefined,
            finish: tag.product.finish || tag.product.category,
          } : undefined,
        }))
      ),
      answers: [...normalizedAnswers, ...normalizedFollowUps].map((a: any) => ({
        questionId: a.questionId || a.q || 'Question',
        questionText: a.q || undefined,
        section: a.roomName || 'General',
        role: 'DESIGNER' as const,
        answer: a.a || '',
        isFollowUp: a.isFollowUp || false,
        roomId: undefined,
      })).filter(a => a.answer.trim()),
      rooms: projectRooms.map(r => ({ id: r.id, name: r.name })),
      imageOrder: gatedValidImageIds,
      correlationId: _cid,
      designerBio,
      projectHistory,
      atelierSummary,
      imageSelections,
      // --- Append-only room chapters (C2/C3/C4) ---
      mode: composeMode,
      frozenChapters: frozenChapters.map((ch) => ({
        title: ch.title,
        roomId: ch.roomId ?? null,
        imageIds: Array.isArray(ch.imageIds) ? ch.imageIds : [],
        body: Array.isArray(ch.body) ? ch.body : [],
        pullQuote: ch.pullQuote ?? null,
        generatedAt: typeof ch.generatedAt === 'number' ? ch.generatedAt : undefined,
        kind: 'editorial' as const,
      })),
      writeRoomNames,
      galleryRoomNames,
      roomNameToId,
      frozenLead: (frozenLead.kicker || frozenLead.deck) ? frozenLead : undefined,
      frozenIntroduction,
      generatedAt: passGeneratedAt,
    };

    let composed: any;
    try {
      const result = await generateEditorialDraft(genInput);
      composed = result.blocks;
    } catch (e: any) {
      console.error("[generate] generation failed:", { code: e?.code, message: e?.message, _cid });

      // Unlock if we acquired a lock
      if (acquireLock) {
        try {
          await patchGenerationInterview(projectId, session.user.id, generationResetId, current => current.status?.phase === 'generating' && current.status.requestId === _cid
            ? { status: { phase: 'idle', endedAt: Date.now(), lastDurationMs: Date.now() - started } } : null);
        } catch (unlockErr) {
          console.error("[posting/interview/generate] Unlock failed", { _cid, unlockErr });
        }
      }

      // `retryable` is the field the UI keys its retry control off. When it is
      // false the failure reproduced — the control should be REMOVED, not
      // disabled, so the designer reads "handled" rather than "denied", and we
      // don't pay for another two-minute call that lands in the same place.
      // Defaults to true only when a thrown error predates the taxonomy.
      return NextResponse.json(
        {
          error: "Story generation failed",
          code: e?.code || "COMPOSE_ERROR",
          message: e?.message,
          retryable: e?.retryable ?? true,
        },
        { status: e?.status || 502 }
      );
    }

    const duration = Date.now() - started;

    // composed is already BlocksSchema-validated from generateEditorialDraft
    // Log generated structure for debugging
    console.log('[GENERATED STRUCTURE]', {
      projectId,
      hasLead: !!composed.lead,
      leadKicker: composed.lead?.kicker?.substring(0, 50),
      leadDeck: composed.lead?.deck?.substring(0, 100),
      chapterCount: composed.galleryChapters?.length || 0,
      chapters: composed.galleryChapters?.map((ch: any) => ({
        title: ch.title,
        bodyParagraphs: ch.body?.length || 0,
        imageCount: ch.imageIds?.length || 0,
        firstParagraphPreview: ch.body?.[0]?.substring(0, 80),
      })),
      pullQuotesCount: composed.pullQuotes?.length || 0,
      materialsCount: composed.materialsLedger?.items?.length || 0,
      durationMs: duration,
      _cid,
    });

    // DEBUG DRY-RUN: compose only, do not persist, respond with diagnostic JSON
    if (debugEcho) {
      return NextResponse.json({
        debug: {
          note: "Dry-run only. Nothing saved.",
          projectId,
          callSource,
        },
        composedPreview: {
          lead: composed.lead,
          narrativeCount: composed.galleryChapters?.[0]?.body?.length || 0,
          firstNarrative: composed.galleryChapters?.[0]?.body?.[0] ?? null,
          pullquotes: composed.pullQuotes?.length || 0,
          galleryChaptersCount: composed.galleryChapters?.length || 0,
          galleryFirstChapter: composed.galleryChapters?.[0] ?? null,
        },
        raw: composed,
      });
    }

    // Replace LLM-generated materialsLedger with DB-sourced one (has valid UUIDs)
    if (materialsLedger) {
      composed.materialsLedger = materialsLedger;
    } else if (composed.materialsLedger?.items) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      for (const item of composed.materialsLedger.items) {
        if (item.productId && !uuidRe.test(item.productId)) delete item.productId;
        if (item.vendorId && !uuidRe.test(item.vendorId)) delete item.vendorId;
      }
    }

    // composed is already BlocksSchema-validated; use it directly
    const validatedBlocks = composed;
    validatedBlocks.mode = 'recomposition';

    // Post-generation accuracy verification (monitoring mode)
    const allGeneratedText = [
      validatedBlocks.lead?.kicker || '',
      validatedBlocks.lead?.deck || '',
      ...(validatedBlocks.introduction || []),
      ...(validatedBlocks.galleryChapters || []).flatMap((ch: any) => ch.body || []),
      ...(validatedBlocks.pullQuotes || []).map((q: any) => typeof q === 'string' ? q : q?.text || ''),
    ].join(' ');
    const allTaggedProducts = validImages.flatMap(img =>
      (img.tags || []).map(tag => ({
        name: tag.product.name,
        vendor: tag.product.vendor?.name,
      }))
    );
    const allInterviewText = normalizedAnswers.map((a: { q: string; a: string }) => `${a.q} ${a.a}`).join(' ') +
      ' ' + normalizedFollowUps.map((f: { q: string; a: string }) => `${f.q} ${f.a}`).join(' ');
    const accuracyCheck = verifyProductAccuracy(allGeneratedText, allTaggedProducts, allInterviewText);
    if (accuracyCheck.warnings.length > 0) {
      console.warn('[EDITORIAL_ACCURACY]', {
        projectId,
        warningCount: accuracyCheck.warnings.length,
        warnings: accuracyCheck.warnings,
        taggedProductCount: allTaggedProducts.length,
        taggedProducts: allTaggedProducts.map(p => `${p.name}${p.vendor ? ` (${p.vendor})` : ''}`),
        _cid,
      });
    }

    // Generation metadata for monitoring
    const allBodyText = [
      ...(validatedBlocks.introduction || []),
      ...(validatedBlocks.galleryChapters || []).flatMap((ch: any) => ch.body || []),
    ].join(' ');
    const wordCount = allBodyText.split(/\s+/).filter(Boolean).length +
      (validatedBlocks.lead?.kicker?.split(/\s+/).length || 0) +
      (validatedBlocks.lead?.deck?.split(/\s+/).length || 0);
    const roomsCovered = (validatedBlocks.galleryChapters || []).map((ch: any) => ch.title || 'Untitled');
    const productsInText = allTaggedProducts
      .filter(p => allGeneratedText.toLowerCase().includes(p.name.toLowerCase()))
      .map(p => p.name);
    const productsNotInText = allTaggedProducts
      .filter(p => !allGeneratedText.toLowerCase().includes(p.name.toLowerCase()))
      .map(p => p.name);

    console.log('[EDITORIAL_GENERATION_META]', JSON.stringify({
      projectId,
      wordCount,
      sectionCount: (validatedBlocks.galleryChapters || []).length,
      pullQuoteCount: (validatedBlocks.pullQuotes || []).length,
      roomsCovered,
      productsInText,
      productsInTags: allTaggedProducts.map(p => p.name),
      unmatchedProducts: productsNotInText,
      accuracyWarnings: accuracyCheck.warnings,
      interviewAnswerCount: normalizedAnswers.length,
      hasFollowUps: normalizedFollowUps.length > 0,
      hasBrandProfile: false,
      hasBio: !!designerBio,
      hasProjectHistory: !!projectHistory,
      hasFingerprint: !!atelierSummary,
      durationMs: duration,
      _cid,
    }));

    // Chapter selections are canonical, including alternatives and provenance.
    // The flat pullQuotes index includes the hook and skips empty rooms; its
    // positions cannot be mapped back onto chapter positions.

    // expandedBlocks is the validated structure ready to save
    const expandedBlocks = validatedBlocks;

    // --- Assembly-order invariant (Addition 1) — the frozenCount override rule
    // depends entirely on this holding. A violation means sectionOverrides are
    // about to repoint at the wrong chapter and corrupt published text. Throw,
    // do NOT persist, do NOT warn. ---
    {
      const chapters: any[] = Array.isArray(expandedBlocks.galleryChapters) ? expandedBlocks.galleryChapters : [];
      const arrEq = (a: any, b: any) =>
        Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x: any, i: number) => x === b[i]);
      // (a) the first frozenCount chapters are byte-identical to the frozen set
      for (let i = 0; i < frozenChapters.length; i++) {
        const p = chapters[i];
        const f = frozenChapters[i];
        if (!p || p.kind !== 'editorial' || p.roomId !== f.roomId || !arrEq(p.body, f.body) || !arrEq(p.imageIds, f.imageIds)) {
          throw Object.assign(new Error(`Assembly invariant violated: frozen chapter ${i} was mutated or reordered`), {
            code: 'FROZEN_CHAPTER_MUTATED', status: 500,
          });
        }
      }
      // (b) no gallery chapter precedes any editorial chapter; and
      // (c) every chapter carries kind, every editorial chapter carries roomId
      let seenGallery = false;
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        if (ch?.kind !== 'editorial' && ch?.kind !== 'gallery') {
          throw Object.assign(new Error(`Assembly invariant violated: chapter ${i} has no kind`), { code: 'CHAPTER_MISSING_KIND', status: 500 });
        }
        if (ch.kind === 'gallery') seenGallery = true;
        else if (ch.kind === 'editorial') {
          if (seenGallery) {
            throw Object.assign(new Error(`Assembly invariant violated: editorial chapter ${i} follows a gallery chapter`), { code: 'GALLERY_BEFORE_EDITORIAL', status: 500 });
          }
          if (!ch.roomId) {
            throw Object.assign(new Error(`Assembly invariant violated: editorial chapter ${i} has no roomId`), { code: 'EDITORIAL_MISSING_ROOMID', status: 500 });
          }
        }
      }
    }

    // --- Merge, not replace (C3) — preserve override/history entries that still
    // point at a stable index: lead/intro (chapterIndex < 0) or a frozen editorial
    // chapter (chapterIndex < frozenCount). Everything else is dropped. On a legacy
    // post frozenCount is 0, so only -1/-2 survive — the one full reweave, no branch. ---
    const frozenCount = frozenChapters.length;
    const preservedOverrides = existingOverrides.filter(
      (o) => typeof o?.chapterIndex === 'number' && (o.chapterIndex < 0 || o.chapterIndex < frozenCount),
    );
    const preservedHistory = existingHistory.filter(
      (h) => typeof h?.chapterIndex === 'number' && (h.chapterIndex < 0 || h.chapterIndex < frozenCount),
    );

    // SAVE (replace existing draft using upsert)
    // IMPORTANT: Do NOT clear interview answers - they persist for future AI training
    
    // Get or create slug
    let slug = post?.slug;
    if (!slug) {
      const { makeSlug } = await import("@/lib/posting/slug");
      slug = makeSlug(projectData.title || undefined, projectId);
    }
    
    // Auto-populate heroAssetId, excerpt, and credits if missing
    // 1. heroAssetId: use first image from galleryChapters[0].imageIds or projectData.images[0]
    let heroAssetId = post ? post.heroAssetId : null;
    if (!heroAssetId) {
      const firstChapterImageId = expandedBlocks?.galleryChapters?.[0]?.imageIds?.[0];
      if (firstChapterImageId && typeof firstChapterImageId === 'string') {
        // Verify the image exists in the project
        const imageExists = projectData.images.some(img => img.id === firstChapterImageId);
        if (imageExists) {
          heroAssetId = firstChapterImageId;
        }
      }
      // Fallback to first project image if no chapter image
      if (!heroAssetId && projectData.images.length > 0) {
        heroAssetId = projectData.images[0].id;
      }
    }
    
    // 2. excerpt: use lead.deck or first paragraph of body
    let excerpt = post ? post.excerpt : null;
    if (!excerpt || excerpt.trim().length === 0) {
      if (expandedBlocks?.lead?.deck) {
        excerpt = expandedBlocks.lead.deck;
      } else if (expandedBlocks?.galleryChapters?.[0]?.body?.[0]) {
        // Use first paragraph, truncated to 300 chars
        const firstPara = String(expandedBlocks.galleryChapters[0].body[0]);
        excerpt = firstPara.length > 300 ? firstPara.slice(0, 297) + '...' : firstPara;
      } else if (projectData.description) {
        excerpt = projectData.description;
      }
    }
    
    // 3. credits: extract from expandedBlocks.credits
    let credits = post ? post.credits : null;
    if (!credits && expandedBlocks?.credits && Array.isArray(expandedBlocks.credits) && expandedBlocks.credits.length > 0) {
      credits = expandedBlocks.credits;
    }
    
    await assertProjectWrite(session.user.id, projectId);
    const saved = await prisma.$transaction(async tx => {
      const current = await tx.projectPost.findUniqueOrThrow({ where: { projectId } });
      // Build the merge from the very row used by the CAS. An earlier "fresh"
      // read can still precede a guided answer/correction and erase its history.
      const existingProvenance = jsonObject(current.provenance) as any;
      const existingInterview = existingProvenance.interview || {};
      if ((existingInterview.resetId ?? null) !== generationResetId) {
        throw Object.assign(new Error('The interview was restarted. Generate again using the new answers.'), { status: 409 });
      }
      if (acquireLock && (existingInterview.status?.phase !== 'generating' || existingInterview.status.requestId !== _cid)) {
        throw Object.assign(new Error('A newer generation attempt owns this draft. Reload to review the saved result.'), { status: 409 });
      }
      const existingPayload = existingInterview.payload || {};
      const guided = existingInterview.guided;
      const sourceGuided = interview.guided;
      if ((guided || sourceGuided) && (guided?.id !== sourceGuided?.id || guided?.version !== sourceGuided?.version)) {
        throw Object.assign(new Error('Your interview changed while the draft was being prepared. Generate again using the saved answers.'), { status: 409 });
      }
      // Empty arrays are an intentional saved state, not permission to restore
      // answers removed by a correction or explicit reset.
      const freshAnswers = Array.isArray(existingPayload.answers) ? existingPayload.answers : (interview?.payload?.answers ?? answersOverride ?? []);
      const freshFollowups = Array.isArray(existingPayload.followups) ? existingPayload.followups : (interview?.payload?.followups ?? []);
      const visibility = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { isPublic: true } });
      if (current.status === 'REVIEW' || current.status === 'ARCHIVED' || (post && current.status !== post.status) || (visibility.isPublic && !projectData.isPublic)) {
        throw Object.assign(new Error('Publication state changed during generation. Retry from the current draft.'), { status: 409 });
      }
      // Editorial generation does not own these choices. Preserve even a choice
      // saved while the model was running; the renderer rechecks pool membership.
      const embeddedQuotes = savedEmbeddedQuoteChoices(current.expandedBlocks);
      if (embeddedQuotes.length) expandedBlocks.embeddedQuotes = embeddedQuotes;
      const result = await tx.projectPost.update({
      where: { projectId, updatedAt: current.updatedAt, status: current.status, provenance: { equals: current.provenance === null ? Prisma.DbNull : current.provenance } },
      data: {
        status: 'DRAFT',
        expandedBlocks: preservePresentation(expandedBlocks, current.expandedBlocks),
        // Merge, not replace (C3): keep override/history entries pointing at
        // lead/intro or a frozen chapter (stable indices); drop the rest.
        sectionOverrides: preservedOverrides as any,
        sectionHistory: preservedHistory as any,
        ...(heroAssetId ? { heroAssetId } : {}),
        ...(excerpt ? { excerpt } : {}),
        ...(credits ? { credits: credits as any } : {}),
        updatedAt: new Date(),
        // Ensure interview data persists - add metadata about generation
        provenance: {
          ...existingProvenance,
          interview: {
            ...existingInterview,
            // Clear any stale failure surfaced by a previous attempt
            lastGenerationError: null,
            generatedAt: Date.now(),
            generatedWith: {
              answerCount: normalizedAnswers.length,
              followupCount: normalizedFollowUps.length,
              selectionCount: allSelections.length,
              imageCount: imageOrder?.length || 0,
            },
            // Keep all original answers and followups intact
            payload: {
              ...existingPayload,
              answers: freshAnswers, // Preserve original answers (re-read fresh)
              followups: freshFollowups, // Preserve original followups (re-read fresh)
              selectedQuestionIds: existingPayload.selectedQuestionIds || interview?.payload?.selectedQuestionIds || [],
              imageOrder: existingPayload.imageOrder || interview?.payload?.imageOrder,
            },
            // Clear generating status if it exists (only if we acquired lock)
            status: acquireLock ? { phase: 'idle', endedAt: Date.now() } : existingInterview.status,
          },
        } as any,
      },
      });
      await tx.project.update({ where: { id: projectId }, data: { isPublic: false, publishedAt: null, status: 'draft' } });
      return result;
    });

    console.log('[AUDIT] generate:saved', {
      projectId,
      mode: expandedBlocks.mode,
      narrativeCount: expandedBlocks?.galleryChapters?.[0]?.body?.length ?? 0,
      chapterBodyLen: expandedBlocks?.galleryChapters?.[0]?.body?.length ?? 0,
      lead: !!expandedBlocks?.lead,
      pullQuotes: expandedBlocks?.pullQuotes?.length ?? 0,
      _cid,
    });

    // Analytics
    await logPassiveEvent({
      type: "draft_generated" as any,
      projectId,
      actorId: session.user.id,
      payload: {
        postId: saved.id,
        provider: 'anthropic',
        duration_ms: duration,
        mode: 'recomposition',
      },
    });

    // Unlock on success (only if we acquired lock)
    if (acquireLock) {
      try {
        console.log("[AUDIT] finally: unlock", { projectId, ok: true, _cid });
        await patchGenerationInterview(projectId, session.user.id, generationResetId, current => current.status?.phase === 'generating' && current.status.requestId === _cid
          ? { status: { phase: 'idle', endedAt: Date.now(), lastDurationMs: duration } } : null);
      } catch (unlockErr) {
        console.error("[posting/interview/generate] Unlock failed", { _cid, unlockErr });
      }
    }

    // Fire-and-forget: generate contextual crops for product tags without crops
    try {
      const { generateProductCrop } = await import("@/lib/crops/generateProductCrop");
      const { uploadCrop } = await import("@/lib/crops/uploadCrop");
      const { getCategoryDefaultScale } = await import("@/lib/crops/categoryDefaults");

      const uncropped = await prisma.productTag.findMany({
        where: { image: { projectId }, cropUrl: null },
        include: {
          image: { select: { id: true, url: true, projectId: true } },
          product: { select: { id: true, category: true } },
        },
      });

      if (uncropped.length > 0) {
        console.log(`[generate] Queueing crop generation for ${uncropped.length} tags`, { projectId, _cid });
        // Run in background — don't await, don't block the response
        (async () => {
          let generated = 0;
          // Process 3 at a time
          for (let i = 0; i < uncropped.length; i += 3) {
            const batch = uncropped.slice(i, i + 3);
            const results = await Promise.allSettled(
              batch.map(async (tag) => {
                const crop = await generateProductCrop({
                  tag: { x: tag.x, y: tag.y, category: tag.product.category },
                  sourceImageUrl: tag.image.url, projectId: tag.image.projectId,
                });
                await uploadCrop({ buffer: crop.buffer, tagId: tag.id, projectId: tag.image.projectId,
                  expected: { imageId: tag.imageId, x: tag.x, y: tag.y, updatedAt: tag.updatedAt },
                  metadata: { cropX: tag.x, cropY: tag.y, cropScale: getCategoryDefaultScale(tag.product.category), cropAspect: "1:1" },
                });
              })
            );
            generated += results.filter((r) => r.status === "fulfilled").length;
          }
          console.log(`[generate] Crop generation complete: ${generated}/${uncropped.length}`, { projectId });
        })().catch((err) => {
          console.error("[generate] Background crop generation failed:", err);
        });
      }
    } catch (cropSetupErr) {
      // Don't fail editorial generation if crop setup fails
      console.error("[generate] Failed to set up crop generation:", cropSetupErr);
    }

    return NextResponse.json({
      ok: true,
      // Rooms withheld from the story because they weren't fully answered. The
      // client surfaces these to the designer ("finish these to include them").
      excludedRooms,
      meta: {
        designerBioMissing: !designerBio,
        hasProjectHistory: !!projectHistory,
        hasAtelierFingerprint: !!atelierSummary,
      },
    }, { status: 200 });
  } catch (error: any) {
    // Ensure unlock on all error paths — but only write if we actually need to clear a lock
    // Also persist lastGenerationError so the preview page can surface it after navigation
    try {
      console.log("[AUDIT] finally: unlock", { projectId, ok: false, _cid });
      if (authorizedActorId && generationResetId !== undefined) await patchGenerationInterview(projectId, authorizedActorId, generationResetId, current => {
        if (current.status?.phase === 'generating' && current.status.requestId !== _cid) return null;
        const changes: Record<string, unknown> = {};
        if (current.status?.phase === 'generating' && current.status.requestId === _cid) {
          const lockStarted = current.status.startedAt;
          changes.status = { phase: 'idle', endedAt: Date.now(), lastDurationMs: lockStarted ? Date.now() - lockStarted : undefined };
        }
        // Persist a user-facing composition failure without replacing evidence.
        if (error?.code === 'COMPOSE_INVALID' || error?.code === 'COMPOSE_LLM_ERROR' || error?.status === 502) {
          changes.lastGenerationError = {
            code: error.code || 'COMPOSE_FAILED',
            message: String(error?.message || 'Story generation failed'),
            failedAt: Date.now(),
          };
        }
        return Object.keys(changes).length ? changes : null;
      });
    } catch (unlockErr) {
      console.error("[posting/interview/generate] Unlock failed in catch", { _cid, unlockErr });
    }
    if (error.name === "ZodError") {
      console.error("[posting/interview/generate] ZodError:", {
        errors: error.errors,
        issues: error.issues,
        message: error.message,
      });
      return NextResponse.json(
        {
          error: "Validation error",
          issues: error.errors || error.issues,
          message: error.message,
        },
        { status: 400 }
      );
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[posting/interview/generate] Error:", error);
    // Respect explicit error.status (e.g. 502 from composeEditorialHard) rather than flattening to 500
    const status = error?.code === 'P2025' ? 409 : typeof error?.status === 'number' ? error.status : 500;
    return NextResponse.json(
      { error: status === 502 ? "Story generation failed" : status === 409 ? error.message : "Internal server error", details: error.message, code: error?.code },
      { status }
    );
  }
}
