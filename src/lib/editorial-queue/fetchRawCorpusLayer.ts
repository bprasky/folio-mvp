// Editorial Queue — raw layer IO (docs/17_EDITORIAL_QUEUE.md, Component 1).
// The only file in this module that touches Prisma. Everything downstream
// (maturity, signals, digest assembly) is pure and fixture-testable.

import { prisma } from '@/lib/prisma';
import { materialClassOf } from './signals';
import type {
  DigestImage,
  DigestInterviewAnswer,
  DigestProduct,
  DigestProject,
  DigestQueuePiece,
  DigestTag,
  RawCorpusLayer,
} from './types';

const ANSWER_TEXT_MAX_CHARS = 600;

// Optional strict scope for Studio refreshes. Legacy unlock callers retain their
// existing corpus; passing an empty project list intentionally returns no work.
export interface EditorialCorpusScope {
  organizationId: string | null;
  projectIds: string[];
}

export async function fetchRawCorpusLayer(designerId: string, scope?: EditorialCorpusScope): Promise<RawCorpusLayer | null> {
  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    select: {
      id: true,
      name: true,
      bio: true,
      studio: true,
      title: true,
      location: true,
      specialties: true,
    },
  });
  if (!designer) return null;

  // The corpus is published stories only: projects whose ProjectPost is
  // PUBLISHED. Drafts and unpublished work are invisible to the queue.
  const projects = await prisma.project.findMany({
    where: {
      ...(scope?.organizationId ? {} : { designerId }),
      post: { status: 'PUBLISHED' },
      ...(scope ? {
        id: { in: scope.projectIds },
        designerOrgId: scope.organizationId,
        isPublic: true,
      } : {}),
    },
    select: {
      id: true,
      title: true,
      category: true,
      budgetBand: true,
      stage: true,
      city: true,
      regionState: true,
      createdAt: true,
      saves: true,
      post: { select: { publishedAt: true, variant: true } },
      rooms: { select: { id: true, name: true, type: true }, orderBy: { id: 'asc' } },
      images: {
        // Stable ordering keeps Map insertion order — and therefore signal
        // tie-breaks and IDs — deterministic run-to-run.
        orderBy: { id: 'asc' },
        select: {
          id: true,
          room: true,
          roomId: true,
          tags: {
            orderBy: { id: 'asc' },
            select: {
              id: true,
              productId: true,
              // Finish lives on the Selection created from the tag, not on
              // Product — see prisma Selection.colorFinish.
              selection: { select: { colorFinish: true } },
              product: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  category: true,
                  brand: true,
                  vendorId: true,
                  imageSource: true,
                },
              },
            },
          },
        },
      },
      editorialInterviews: {
        select: {
          answers: {
            select: {
              id: true,
              questionText: true,
              answerText: true,
              questionSource: true,
              roomId: true,
              isFollowUp: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const digestProjects: DigestProject[] = [];
  const digestImages: DigestImage[] = [];
  const digestTags: DigestTag[] = [];
  const productsById = new Map<string, DigestProduct>();
  const interviewAnswers: DigestInterviewAnswer[] = [];

  for (const project of projects) {
    const roomById = new Map(project.rooms.map((r) => [r.id, r]));
    let projectTagCount = 0;

    for (const image of project.images) {
      const room = image.roomId ? roomById.get(image.roomId) : undefined;
      for (const tag of image.tags) {
        projectTagCount++;
        digestTags.push({
          tagId: tag.id,
          productId: tag.productId,
          imageId: image.id,
          projectId: project.id,
        });
        const selectionFinish = tag.selection?.colorFinish ?? null;
        const existing = productsById.get(tag.product.id);
        if (!existing) {
          const nameText = `${tag.product.name} ${tag.product.description ?? ''}`;
          productsById.set(tag.product.id, {
            productId: tag.product.id,
            name: tag.product.name,
            category: tag.product.category,
            brand: tag.product.brand,
            colorFinish: selectionFinish,
            finishFamily: materialClassOf(selectionFinish, nameText),
            vendorId: tag.product.vendorId,
            imageSource: tag.product.imageSource,
          });
        } else if (!existing.colorFinish && selectionFinish) {
          // A later tag's selection carries the finish the first sighting lacked.
          existing.colorFinish = selectionFinish;
          existing.finishFamily = materialClassOf(
            selectionFinish,
            `${tag.product.name} ${tag.product.description ?? ''}`
          );
        }
      }
      digestImages.push({
        imageId: image.id,
        projectId: project.id,
        roomName: room?.name ?? image.room,
        roomType: room?.type ?? null,
        tagCount: image.tags.length,
        derivedSaveCount: 0, // filled in after the Save groupBy below
      });
    }

    digestProjects.push({
      projectId: project.id,
      title: project.title,
      category: project.category,
      budgetBand: project.budgetBand,
      stage: project.stage,
      city: project.city,
      regionState: project.regionState,
      createdAt: project.createdAt.toISOString(),
      publishedAt: project.post?.publishedAt?.toISOString() ?? null,
      postVariant: project.post?.variant ?? null,
      roomTypes: Array.from(
        new Set(project.rooms.map((r) => r.type).filter((t): t is string => !!t))
      ),
      tagCount: projectTagCount,
      saveCount: project.saves,
    });

    for (const interview of project.editorialInterviews) {
      for (const answer of interview.answers) {
        interviewAnswers.push({
          answerId: answer.id,
          projectId: project.id,
          questionText: answer.questionText,
          answerText: answer.answerText.slice(0, ANSWER_TEXT_MAX_CHARS),
          questionSource: answer.questionSource,
          roomName: answer.roomId ? roomById.get(answer.roomId)?.name ?? null : null,
          isFollowUp: answer.isFollowUp,
        });
      }
    }
  }

  // Save-delta derivation: product-level Save rows joined through the tags on
  // each image (no image-level save table exists; see the 17_EDITORIAL_QUEUE
  // raw-layer note).
  const taggedProductIds = Array.from(productsById.keys());
  const productSaves: Record<string, number> = {};
  if (taggedProductIds.length > 0) {
    const saveCounts = await prisma.save.groupBy({
      by: ['productId'],
      where: { productId: { in: taggedProductIds } },
      _count: { productId: true },
    });
    for (const row of saveCounts) {
      productSaves[row.productId] = row._count.productId;
    }
  }
  const saveCountByImage = new Map<string, number>();
  for (const tag of digestTags) {
    saveCountByImage.set(
      tag.imageId,
      (saveCountByImage.get(tag.imageId) ?? 0) + (productSaves[tag.productId] ?? 0)
    );
  }
  for (const image of digestImages) {
    image.derivedSaveCount = saveCountByImage.get(image.imageId) ?? 0;
  }

  // Feedback loop: prior queue pieces inform angle freshness in extraction.
  const priorPieces = await prisma.editorialQueueItem.findMany({
    where: {
      designerId,
      status: { in: ['completed', 'scheduled', 'published'] },
      ...(scope ? { angle: { designerId, organizationId: scope.organizationId } } : {}),
    },
    select: {
      id: true,
      format: true,
      status: true,
      completedAt: true,
      angle: { select: { angleType: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const priorQueuePieces: DigestQueuePiece[] = priorPieces.map((piece) => ({
    queueItemId: piece.id,
    angleType: piece.angle.angleType,
    format: piece.format,
    status: piece.status,
    completedAt: piece.completedAt?.toISOString() ?? null,
  }));

  return {
    designer: {
      id: designer.id,
      name: designer.name,
      bio: designer.bio,
      studio: designer.studio,
      title: designer.title,
      location: designer.location,
      specialties: designer.specialties,
    },
    projects: digestProjects,
    images: digestImages,
    tags: digestTags,
    products: Array.from(productsById.values()),
    interviewAnswers,
    priorQueuePieces,
    productSaves,
  };
}
