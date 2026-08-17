/**
 * Product Record assembly (spec 22_PRODUCT_RECORD, Phase A).
 *
 * A Product Record is the Product entity at Corpus scope: many projects against
 * one product, where a project Super-Article is many contributors against one
 * project. Same block library, different join key.
 *
 * This module is the serializer, and the serializer is where the gate lives.
 * Testimony the audience may not read is dropped here, before it reaches the
 * RSC payload — a component that filters on render has already shipped the
 * words to the browser. Same doctrine as `imageProvenance.ts`.
 *
 * JOIN PATH, stated once because it is easy to get wrong:
 *   ProductTag.productId -> Product.id
 *   ProductTag.imageId   -> ProjectImage.id
 *   ProjectImage.projectId -> Project.id
 *   SupplementalQuote.productTagId -> ProductTag.id
 * Project has no `projectId`; it has `id`.
 */

import { prisma } from '@/lib/prisma';
import { isProfessionalRole } from '@/lib/constants/roles';
import { resolveProductImage } from '@/lib/products/imageProvenance';
import {
  coverageDisclosure,
  evaluateRecordTier,
  isTestimonyVisible,
  rankTestimony,
  type RecordAudience,
  type RecordCoverage,
} from '@/lib/products/productRecord';
import { PUBLISHED_PROJECT_FILTER } from '@/server/queries/filters';
import type {
  ProductRecordTier,
  Role,
  TestimonyClass,
  VendorRecordState,
} from '@prisma/client';

export interface RecordInstallation {
  imageId: string;
  imageUrl: string;
  room: string | null;
  projectId: string;
  projectTitle: string;
  /** Slug of the published Super-Article, when the project has one. */
  postSlug: string | null;
  designerName: string | null;
  specifiedAt: Date;
}

export interface RecordTestimony {
  id: string;
  question: string;
  answer: string;
  testimonyClass: TestimonyClass;
  designerId: string | null;
  designerName: string | null;
  designerCompany: string | null;
  contributorRole: string | null;
  projectId: string | null;
  projectTitle: string | null;
  postSlug: string | null;
  /** The designer's own in-situ crop, when this quote hangs off a tagged image. */
  installShotUrl: string | null;
  createdAt: Date;
}

export interface ProductRecordView {
  productId: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  vendorName: string | null;

  tier: ProductRecordTier;
  vendorState: VendorRecordState;
  audience: RecordAudience;

  /** Provenance-gated. Null means placeholder upstream, never a vendor studio shot. */
  heroImageUrl: string | null;

  coverage: RecordCoverage;
  /** "Specified by 40 designers across 47 projects. 6 have testified." */
  coverageDisclosure: string;

  /** First specifier, permanently. Never displaced by later contributors. */
  firstSpecifier: { id: string | null; name: string | null } | null;

  installations: RecordInstallation[];

  /** Empty when gated. Check `testimonyLocked` to tell "none" from "not for you". */
  testimony: RecordTestimony[];
  testimonyLocked: boolean;
  /** How many pieces exist but were withheld from this audience. */
  lockedTestimonyCount: number;
}

/**
 * Which audience a viewer belongs to.
 *
 * Professional roles and admins read as DESIGNER: they are the specifiers the
 * corpus is for. Everyone else is PUBLIC unless they are a member of an
 * organization holding a claim on this product, or the product's own vendor
 * user — those are the vendor, and claiming is what unlocks them.
 */
export async function resolveRecordAudience(
  productId: string,
  viewer: { id?: string | null; role?: string | null } | null | undefined,
): Promise<RecordAudience> {
  const userId = viewer?.id;
  if (!userId) return 'PUBLIC';

  const role = viewer?.role as Role | undefined;
  if (role === 'ADMIN') return 'DESIGNER';
  if (role && isProfessionalRole(role)) return 'DESIGNER';

  const [ownsProduct, claimAsMember] = await Promise.all([
    prisma.product.count({ where: { id: productId, vendorId: userId } }),
    prisma.vendorProductClaim.count({
      where: {
        productId,
        organization: { users: { some: { userId, isActive: true } } },
      },
    }),
  ]);

  if (ownsProduct > 0 || claimAsMember > 0) return 'VENDOR_OWNER';
  return 'PUBLIC';
}

/** COLLABORATING beats CLAIMED beats TAGGED. Absence of a claim row is TAGGED. */
function highestVendorState(states: VendorRecordState[]): VendorRecordState {
  if (states.includes('COLLABORATING')) return 'COLLABORATING';
  if (states.includes('CLAIMED')) return 'CLAIMED';
  return 'TAGGED';
}

/**
 * Build the Product Record for one product and one audience.
 *
 * Coverage is computed live from `product_tags` rather than read from the
 * denormalized columns on Product. The counts on the row are a cache for list
 * surfaces; a Record that read them could publish a coverage sentence that
 * disagrees with the projects listed directly beneath it, and the disclosure is
 * load-bearing enough that it must not be able to drift.
 *
 * Only published projects count. This fetcher is public-facing for every
 * audience — a designer reading this record is not the author of most of these
 * projects — so the published filter applies unconditionally, unlike a draft or
 * staging fetcher. See tasks/lessons.md, "Public vs draft query asymmetry".
 */
export async function getProductRecord(
  productId: string,
  audience: RecordAudience,
): Promise<ProductRecordView | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
      description: true,
      imageUrl: true,
      cutoutImageUrl: true,
      imageSource: true,
      vendor: { select: { name: true, companyName: true } },
    },
  });
  if (!product) return null;

  const tags = await prisma.productTag.findMany({
    // PUBLISHED_PROJECT_FILTER is `as const`, so its OR array is readonly and
    // does not satisfy Prisma's mutable `ProjectWhereInput[]` in a nested
    // relation filter. Copy the array rather than widening the shared constant,
    // which every other caller spreads at top level.
    where: { productId, image: { project: { OR: [...PUBLISHED_PROJECT_FILTER.OR] } } },
    select: {
      id: true,
      cropUrl: true,
      createdAt: true,
      image: {
        select: {
          id: true,
          url: true,
          room: true,
          project: {
            select: {
              id: true,
              title: true,
              designerId: true,
              ownerId: true,
              designer: { select: { name: true } },
              owner: { select: { name: true } },
              post: { select: { slug: true, status: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Read regardless of whether the product has been tagged. A vendor may claim a
  // product before any designer specifies it, and the claim is what the gate
  // reads — not the tags.
  const claims = await prisma.vendorProductClaim.findMany({
    where: { productId },
    select: { state: true },
  });
  const vendorState = highestVendorState(claims.map((c) => c.state));

  // A project's specifier is its designer, falling back to its owner. ownerId is
  // required on Project, so this resolves for every row.
  const specifierOf = (p: (typeof tags)[number]['image']['project']) =>
    p.designerId ?? p.ownerId ?? null;
  const specifierNameOf = (p: (typeof tags)[number]['image']['project']) =>
    p.designer?.name ?? p.owner?.name ?? null;

  // Testimony is read only from PUBLISHED posts. A project can be public while
  // its Super-Article is still in draft, and a supplemental quote is content
  // written for that article — surfacing it here would publish a designer's
  // words ahead of the post they belong to, on a page they were never shown.
  // This filter applies for every audience, including DESIGNER, because the
  // Record is not the author's own staging view of anyone's draft.
  const quotes = tags.length
    ? await prisma.supplementalQuote.findMany({
        where: {
          productTagId: { in: tags.map((t) => t.id) },
          post: { status: 'PUBLISHED' },
        },
        select: {
          id: true,
          question: true,
          answer: true,
          testimonyClass: true,
          contributorRole: true,
          productTagId: true,
          userId: true,
          createdAt: true,
          user: { select: { id: true, name: true, companyName: true } },
        },
      })
    : [];

  const tagById = new Map(tags.map((t) => [t.id, t]));

  // ── Coverage ──────────────────────────────────────────────────────────────
  const specifications = tags.map((t) => ({
    designerId: specifierOf(t.image.project),
    projectId: t.image.project.id,
  }));
  const coverage: RecordCoverage = {
    specifierCount: new Set(specifications.map((s) => s.designerId).filter(Boolean)).size,
    projectCount: new Set(specifications.map((s) => s.projectId)).size,
    testimonyCount: quotes.length,
  };

  // ── Tier ──────────────────────────────────────────────────────────────────
  // The testimony's designer is the quote's author where recorded, falling back
  // to the specifier of the project the quote hangs off. A commissioned quote
  // always carries a userId; the fallback is for volunteer quotes written before
  // multi-party attribution existed.
  const tier = evaluateRecordTier({
    specifications,
    testimony: quotes.map((q) => {
      const tag = q.productTagId ? tagById.get(q.productTagId) : undefined;
      return {
        designerId: q.userId ?? (tag ? specifierOf(tag.image.project) : null),
        testimonyClass: q.testimonyClass,
      };
    }),
  });

  // ── Imagery ───────────────────────────────────────────────────────────────
  // Records are built from designer photography. `resolveProductImage` at PUBLIC
  // is what keeps a VENDOR_REFERENCE studio shot off the surface; the in-situ
  // crop is the fallback, and null means a placeholder upstream rather than the
  // vendor's own image sneaking in through the back.
  const firstCrop = tags.find((t) => t.cropUrl)?.cropUrl ?? null;
  const heroImageUrl = resolveProductImage(
    {
      imageUrl: product.imageUrl,
      cutoutImageUrl: product.cutoutImageUrl,
      imageSource: product.imageSource,
    },
    firstCrop,
    'PUBLIC',
  );

  // One entry per project image, not per tag: the same photograph tagged twice
  // is one installation, and listing it twice would inflate what the reader
  // perceives as coverage without inflating the disclosed counts.
  const seenImages = new Set<string>();
  const installations: RecordInstallation[] = [];
  for (const tag of tags) {
    if (seenImages.has(tag.image.id)) continue;
    seenImages.add(tag.image.id);
    const project = tag.image.project;
    installations.push({
      imageId: tag.image.id,
      imageUrl: tag.cropUrl ?? tag.image.url,
      room: tag.image.room,
      projectId: project.id,
      projectTitle: project.title,
      postSlug: project.post?.status === 'PUBLISHED' ? project.post.slug : null,
      designerName: specifierNameOf(project),
      specifiedAt: tag.createdAt,
    });
  }

  // ── Provenance ────────────────────────────────────────────────────────────
  // The first specifier is attributed permanently and is never displaced by
  // later contributors regardless of their standing. It costs nothing, derives
  // from a timestamp already held, and is the strongest reason for a designer to
  // tag a product before anyone else does. (`21_ASSET_MATRIX` §8.)
  const firstTag = tags[0];
  const firstSpecifier = firstTag
    ? {
        id: specifierOf(firstTag.image.project),
        name: specifierNameOf(firstTag.image.project),
      }
    : null;

  // ── The gate ──────────────────────────────────────────────────────────────
  const visible = quotes.filter((q) =>
    isTestimonyVisible(audience, vendorState, q.testimonyClass),
  );

  const testimony: RecordTestimony[] = rankTestimony(
    visible.map((q) => {
      const tag = q.productTagId ? tagById.get(q.productTagId) : undefined;
      const project = tag?.image.project ?? null;
      return {
        id: q.id,
        question: q.question,
        answer: q.answer,
        testimonyClass: q.testimonyClass,
        designerId: q.user?.id ?? null,
        designerName: q.user?.name ?? (project ? specifierNameOf(project) : null),
        designerCompany: q.user?.companyName ?? null,
        contributorRole: q.contributorRole,
        projectId: project?.id ?? null,
        projectTitle: project?.title ?? null,
        postSlug: project?.post?.status === 'PUBLISHED' ? project.post.slug : null,
        installShotUrl: tag?.cropUrl ?? tag?.image.url ?? null,
        createdAt: q.createdAt,
        // rankTestimony reads this; it is stripped before the view is returned.
        hasInstallShot: Boolean(tag?.cropUrl ?? tag?.image.url),
      };
    }),
  ).map(({ hasInstallShot: _hasInstallShot, ...rest }) => rest);

  return {
    productId: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
    vendorName: product.vendor?.companyName ?? product.vendor?.name ?? product.brand ?? null,

    tier,
    vendorState,
    audience,

    heroImageUrl,

    coverage,
    coverageDisclosure: coverageDisclosure(coverage),

    firstSpecifier,
    installations,

    testimony,
    testimonyLocked: visible.length < quotes.length,
    lockedTestimonyCount: quotes.length - visible.length,
  };
}

/**
 * Recompute the denormalized coverage cache and record tier on Product.
 *
 * Nothing on the Record surface reads these columns — `getProductRecord`
 * computes coverage live — so a stale cache can under-report a list surface but
 * can never produce a wrong Record. That property is what makes it safe to
 * refresh in batch (`scripts/refresh-product-record-cache.ts`) rather than
 * wiring four ProductTag creation sites into a write on the tagging hot path.
 *
 * `recordPublishedAt` is stamped the first time a record reaches ARTICLE and is
 * never cleared. Publication is a consequence of commissioned testimony
 * existing, and testimony is not un-published when a vendor lapses.
 */
export async function refreshProductRecordCache(productId: string): Promise<{
  tier: ProductRecordTier;
  coverage: RecordCoverage;
} | null> {
  // Computed at the DESIGNER audience deliberately: the cache describes what the
  // record contains, not what any one viewer may read.
  const record = await getProductRecord(productId, 'DESIGNER');
  if (!record) return null;

  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: { recordPublishedAt: true },
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      recordTier: record.tier,
      specifierCount: record.coverage.specifierCount,
      projectCount: record.coverage.projectCount,
      testimonyCount: record.coverage.testimonyCount,
      ...(record.tier === 'ARTICLE' && !existing?.recordPublishedAt
        ? { recordPublishedAt: new Date() }
        : {}),
    },
  });

  return { tier: record.tier, coverage: record.coverage };
}
