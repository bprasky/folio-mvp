export const dynamic = 'force-dynamic';

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getStudioData, StudioAccessError } from '@/lib/publishing-studio/data';
import { revalidatePath } from 'next/cache';
import { assertProjectWrite } from '@/lib/authz/access';
import { projectPhotoProcessingUrl } from '@/lib/server/protected-project-photo';
import {
  generateAllSlides,
  type ExportConfig,
  type AspectRatio,
} from '@/lib/instagram-export/generate-images';
import type { HeadlinePosition, WatermarkStyle } from '@/lib/instagram-export/svg-templates';
import { publicationPhotos, publicationRevision } from '@/lib/instagram-export/publication-photo';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, config, caption, exportId, expectedUpdatedAt, saveOnly = false } = body;

    if (typeof projectId !== 'string' || !config || typeof config !== 'object' || Array.isArray(config) || (caption !== undefined && typeof caption !== 'string') || typeof saveOnly !== 'boolean' || (exportId !== undefined && typeof exportId !== 'string')) {
      return NextResponse.json(
        { error: 'projectId and config are required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        post: true,
        designer: true,
        designerOrg: { select: { name: true } },
        images: { where: { inclusion: 'INCLUDED' }, orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!project || !project.post || project.post.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Published project not found' }, { status: 404 });
    }

    try {
      await assertProjectWrite(session.user.id, project.id);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = exportId ? await prisma.instagramExport.findFirst({
      where: { id: exportId, projectId, designerId: session.user.id },
      select: { id: true, updatedAt: true, config: true },
    }) : null;
    if (exportId && !existing) return NextResponse.json({ error: 'Carousel not found' }, { status: 404 });
    if (existing && (typeof expectedUpdatedAt !== 'string' || expectedUpdatedAt !== existing.updatedAt.toISOString())) {
      return NextResponse.json({ error: 'This carousel changed in another session. Reload before saving.' }, { status: 409 });
    }
    if ((config.aspectRatio && !['1:1', '4:5', '9:16'].includes(config.aspectRatio)) ||
      (config.coverTextMode !== undefined && !['room', 'headline'].includes(config.coverTextMode)) ||
      (config.watermarkStyle && !['folio_x', 'folio_presents', 'minimal'].includes(config.watermarkStyle)) ||
      (config.headlinePosition && !['bottom_left', 'bottom_center', 'top_left'].includes(config.headlinePosition)) ||
      (config.slideCount !== undefined && ![2, 3, 4, 5].includes(config.slideCount)) ||
      (config.headline !== undefined && (typeof config.headline !== 'string' || config.headline.length > 300)) ||
      (config.bioText !== undefined && typeof config.bioText !== 'string') ||
      (config.bioEnabled !== undefined && typeof config.bioEnabled !== 'boolean') ||
      (config.roomId !== undefined && typeof config.roomId !== 'string') ||
      (config.selectedImageUrls !== undefined && (!Array.isArray(config.selectedImageUrls) || config.selectedImageUrls.length > 200 || config.selectedImageUrls.some((url: unknown) => typeof url !== 'string' || !project.images.some((image) => image.url === url))))) {
      return NextResponse.json({ error: 'Invalid carousel settings or project images' }, { status: 400 });
    }

    const firstId = !exportId && typeof config.studioCardId === 'string'
      ? `studio_${createHash('sha256').update(`${session.user.id}\0${config.studioCardId}`).digest('hex').slice(0, 40)}` : undefined;
    const readFirst = () => prisma.instagramExport.findFirst({
      where: { id: firstId!, projectId, designerId: session.user.id },
      select: { id: true, updatedAt: true, config: true, status: true },
    });
    let firstSaved = firstId ? await readFirst() : null;
    let studioCardId: string | undefined;
    if (!existing && config.studioCardId !== undefined) {
      try {
        const studio = await getStudioData(session.user.id, project.id);
        const card = studio.feed.find(item => item.id === config.studioCardId);
        if (!firstSaved && firstId) firstSaved = await readFirst();
        if (!firstSaved && (!card || card.revision !== config.studioRevision || card.kind !== 'suggestion' || !card.canPolish || card.projectIds.length !== 1 || card.projectIds[0] !== project.id)) {
          return NextResponse.json({ error: 'This proposal changed. Return to the Studio to review it before saving.' }, { status: 409 });
        }
        if (firstSaved && !studio.projects.some(item => item.id === projectId && item.canCreateCampaign)) {
          return NextResponse.json({ error: 'This draft is no longer available in this workspace.' }, { status: 403 });
        }
        studioCardId = config.studioCardId;
      } catch (error) {
        if (error instanceof StudioAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
        throw error;
      }
    }

    const proposal: Record<string, string | string[]> = {};
    const previous = existing?.config && typeof existing.config === 'object' && !Array.isArray(existing.config) ? existing.config : {};
    for (const key of ['pitch', 'rationale', 'beats', 'headlineOptions', 'captionOptions']) {
      const value = config[key] ?? previous[key];
      if (value === undefined) continue;
      const valid = ['pitch', 'rationale'].includes(key)
        ? typeof value === 'string' && value.length <= 5000
        : Array.isArray(value) && value.length <= 10 && value.every(item => typeof item === 'string' && item.length <= 5000);
      if (!valid) return NextResponse.json({ error: 'Invalid story proposal' }, { status: 400 });
      proposal[key] = value as string | string[];
    }

    const designer = project.designer ?? await prisma.user.findUnique({
      where: { id: project.ownerId },
      select: { name: true, studio: true, companyName: true, title: true, profileImage: true },
    });
    const photos = publicationPhotos(project, project.post, project.images, designer);
    if (config.publicationRevision !== undefined && config.publicationRevision !== publicationRevision(photos)) {
      return NextResponse.json({ error: 'The article photos, words or theme changed. Refresh this preview before exporting.' }, { status: 409 });
    }
    if (!saveOnly && config.coverTextMode === 'headline' && !config.headline?.trim()) {
      return NextResponse.json({ error: 'Add an opening headline or choose the article’s room quote.' }, { status: 400 });
    }

    const exportConfig: ExportConfig = {
      coverTextMode: config.coverTextMode === 'headline' ? 'headline' : 'room',
      publicationPhotos: Object.fromEntries((config.selectedImageUrls || project.images.map(image => image.url)).map((url: string) => [url, photos[url]])),
      aspectRatio: (config.aspectRatio || '4:5') as AspectRatio,
      watermarkStyle: (config.watermarkStyle || 'folio_x') as WatermarkStyle,
      headlinePosition: (config.headlinePosition || 'bottom_left') as HeadlinePosition,
      headline: config.headline ?? project.title,
      designerName: designer?.name || 'Designer',
      designerTitle: designer?.title || undefined,
      studioName: project.designerOrg?.name || designer?.studio || designer?.companyName || undefined,
      bioEnabled: config.bioEnabled ?? true,
      bioText: config.bioText,
      projectName: project.title,
      slideCount: config.slideCount || 5,
      selectedImageUrls: config.selectedImageUrls || project.images.map((img) => img.url),
      roomId: config.roomId,
    };
    if (!saveOnly && !exportConfig.selectedImageUrls.length) {
      return NextResponse.json({ error: 'Choose at least one project photo before exporting.' }, { status: 400 });
    }

    // Bind retries to the exact submitted content. Later explicit edits remove
    // this fingerprint, so an old first-save request can never overwrite them.
    const firstSaveFingerprint = firstId ? createHash('sha256').update(JSON.stringify({
      exportConfig, proposal, caption: caption ?? null, revision: config.studioRevision,
    })).digest('hex') : undefined;
    const sameFirstSave = (record: NonNullable<typeof firstSaved>) => {
      const value = record.config;
      return value && typeof value === 'object' && !Array.isArray(value)
        && value.firstSaveFingerprint === firstSaveFingerprint && record.status === (saveOnly ? 'draft' : 'generated');
    };
    if (firstSaved && !sameFirstSave(firstSaved)) return NextResponse.json({ error: 'This story already has a different saved draft. Reopen it from In progress before saving.' }, { status: 409 });

    // Provider-only URLs are never persisted in the saved export configuration.
    // Only the photo slots in this carousel need processing URLs; a large
    // project can retain its full selection without signing hundreds of images.
    const photoSlots = Math.max(1, exportConfig.slideCount - (exportConfig.bioEnabled ? 1 : 0) - 1);
    const visibleUrls = exportConfig.selectedImageUrls.slice(0, photoSlots);
    const renderUrls = saveOnly ? [] : await Promise.all(visibleUrls.map(url => projectPhotoProcessingUrl(url, project.id)));
    const renderConfig = { ...exportConfig,
      selectedImageUrls: renderUrls,
      publicationPhotos: Object.fromEntries(visibleUrls.map((url, index) => [renderUrls[index], photos[url]])),
    };
    const slides = saveOnly ? [] : await generateAllSlides(renderConfig, designer?.profileImage || undefined);

    // Return images as base64-encoded data URLs for client-side download
    const images = slides.map((slide) => ({
      slideIndex: slide.slideIndex,
      type: slide.type,
      dataUrl: `data:image/jpeg;base64,${slide.buffer.toString('base64')}`,
    }));

    if (firstSaved) return NextResponse.json({ images, export: { id: firstSaved.id, updatedAt: firstSaved.updatedAt.toISOString() } });

    const updatedAt = new Date(Math.max(Date.now(), existing ? existing.updatedAt.getTime() + 1 : 0));
    const data = {
      config: {
        ...exportConfig,
        ...proposal,
        ...(studioCardId ? { studioCardId } : {}),
        ...(firstSaveFingerprint ? { firstSaveFingerprint } : {}),
        ...(existing?.config && typeof existing.config === 'object' && !Array.isArray(existing.config)
          && typeof existing.config.studioCardId === 'string' ? { studioCardId: existing.config.studioCardId } : {}),
      } as any,
      headline: exportConfig.headline,
      bioText: exportConfig.bioText ?? null,
      ...(caption !== undefined ? { caption } : {}),
      status: saveOnly ? 'draft' : 'generated',
      imageUrls: [],
      exportedAt: null,
      updatedAt,
    };
    let savedId: string;
    if (existing) {
      const saved = await prisma.instagramExport.updateMany({
        where: { id: existing.id, projectId, designerId: session.user.id, updatedAt: existing.updatedAt },
        data,
      });
      if (saved.count !== 1) return NextResponse.json({ error: 'This carousel changed while saving. Reload before trying again.' }, { status: 409 });
      savedId = existing.id;
    } else {
      try {
        const saved = await prisma.instagramExport.create({
          data: { ...data, ...(firstId ? { id: firstId } : {}), projectId, designerId: session.user.id },
          select: { id: true },
        });
        savedId = saved.id;
      } catch (error) {
        if (!firstId || !(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error;
        const winner = await readFirst();
        if (!winner || !sameFirstSave(winner)) return NextResponse.json({ error: 'This story was saved in another session. Reopen its draft before saving your changes.' }, { status: 409 });
        return NextResponse.json({ images, export: { id: winner.id, updatedAt: winner.updatedAt.toISOString() } });
      }
    }
    revalidatePath('/designer/studio');
    return NextResponse.json({ images, export: { id: savedId, updatedAt: updatedAt.toISOString() } });
  } catch (error: any) {
    console.error('[instagram-export/generate-images]', error);
    return NextResponse.json(
      { error: 'Unable to save or export this carousel. Please try again.' },
      { status: 500 }
    );
  }
}
