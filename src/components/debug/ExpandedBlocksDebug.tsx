'use client';

import { useEffect } from 'react';

interface ExpandedBlocksDebugProps {
  post?: {
    id?: string;
    status?: string;
    expandedBlocks?: any;
  } | null;
  editorialDraft?: any;
  projectTitle?: string;
}

/**
 * Client-side debug component that logs expandedBlocks status to browser console
 * This helps diagnose why articles aren't showing on published posts
 */
export function ExpandedBlocksDebug({ post, editorialDraft, projectTitle }: ExpandedBlocksDebugProps) {
  useEffect(() => {
    console.group('🔍 [CLIENT] ExpandedBlocks Debug - Published Post');
    console.log('Project Title:', projectTitle);
    console.log('Post ID:', post?.id);
    console.log('Post Status:', post?.status);
    
    // Check ProjectPost.expandedBlocks
    console.group('📄 ProjectPost.expandedBlocks:');
    console.log('Exists:', !!post?.expandedBlocks);
    console.log('Type:', typeof post?.expandedBlocks);
    if (post?.expandedBlocks) {
      const blocks = post.expandedBlocks as any;
      console.log('Keys:', Object.keys(blocks));
      console.log('Lead:', {
        title: blocks.lead?.title,
        kicker: blocks.lead?.kicker,
        deck: blocks.lead?.deck,
        deckLength: blocks.lead?.deck?.length,
      });
      console.log('Gallery Chapters:', {
        count: Array.isArray(blocks.galleryChapters) ? blocks.galleryChapters.length : 0,
        firstChapter: blocks.galleryChapters?.[0] ? {
          title: blocks.galleryChapters[0].title,
          bodyLength: blocks.galleryChapters[0].body?.length || 0,
          bodyTotalChars: Array.isArray(blocks.galleryChapters[0].body)
            ? blocks.galleryChapters[0].body.reduce((sum: number, p: string) => sum + p.length, 0)
            : 0,
          imageIdsCount: blocks.galleryChapters[0].imageIds?.length || 0,
        } : null,
      });
      console.log('Full expandedBlocks:', blocks);
    } else {
      console.warn('❌ ProjectPost.expandedBlocks is MISSING or NULL');
    }
    console.groupEnd();
    
    // Check EditorialDraft
    console.group('📝 EditorialDraft (what page is actually using):');
    console.log('Exists:', !!editorialDraft);
    if (editorialDraft) {
      console.log('Keys:', Object.keys(editorialDraft));
      console.log('Lead:', {
        title: editorialDraft.lead?.title,
        kicker: editorialDraft.lead?.kicker,
        deck: editorialDraft.lead?.deck,
        deckLength: editorialDraft.lead?.deck?.length,
      });
      console.log('Gallery Chapters:', {
        count: Array.isArray(editorialDraft.galleryChapters) ? editorialDraft.galleryChapters.length : 0,
        firstChapter: editorialDraft.galleryChapters?.[0] ? {
          title: editorialDraft.galleryChapters[0].title,
          bodyLength: editorialDraft.galleryChapters[0].body?.length || 0,
          bodyTotalChars: Array.isArray(editorialDraft.galleryChapters[0].body)
            ? editorialDraft.galleryChapters[0].body.reduce((sum: number, p: string) => sum + p.length, 0)
            : 0,
          imageIdsCount: editorialDraft.galleryChapters[0].imageIds?.length || 0,
        } : null,
      });
      console.log('Full editorialDraft:', editorialDraft);
    } else {
      console.warn('❌ EditorialDraft is MISSING or NULL');
    }
    console.groupEnd();
    
    // Comparison
    console.group('⚖️ Comparison:');
    const hasProjectPostBlocks = !!post?.expandedBlocks;
    const hasEditorialDraft = !!editorialDraft;
    const projectPostHasContent = hasProjectPostBlocks && 
      (!!(post.expandedBlocks as any)?.lead?.kicker || !!(post.expandedBlocks as any)?.lead?.deck) &&
      Array.isArray((post.expandedBlocks as any)?.galleryChapters) &&
      (post.expandedBlocks as any).galleryChapters.length > 0;
    const editorialDraftHasContent = hasEditorialDraft &&
      (!!editorialDraft?.lead?.kicker || !!editorialDraft?.lead?.deck) &&
      Array.isArray(editorialDraft?.galleryChapters) &&
      editorialDraft.galleryChapters.length > 0;
    
    console.log('ProjectPost.expandedBlocks has content:', projectPostHasContent);
    console.log('EditorialDraft has content:', editorialDraftHasContent);
    
    if (projectPostHasContent && !editorialDraftHasContent) {
      console.error('⚠️ ISSUE FOUND: ProjectPost.expandedBlocks has content but EditorialDraft does not!');
      console.error('   The page is using EditorialDraft (empty) instead of ProjectPost.expandedBlocks (has content)');
    } else if (!projectPostHasContent && editorialDraftHasContent) {
      console.warn('⚠️ ProjectPost.expandedBlocks is empty, but EditorialDraft has content (this is expected if using EditorialDraft)');
    } else if (projectPostHasContent && editorialDraftHasContent) {
      console.log('✅ Both have content - comparing...');
      const ppKicker = (post.expandedBlocks as any)?.lead?.kicker;
      const edKicker = editorialDraft?.lead?.kicker;
      if (ppKicker !== edKicker) {
        console.warn('⚠️ Content differs between ProjectPost and EditorialDraft');
        console.log('ProjectPost kicker:', ppKicker);
        console.log('EditorialDraft kicker:', edKicker);
      }
    } else {
      console.error('❌ NEITHER has content - article will not display!');
    }
    console.groupEnd();
    
    console.groupEnd();
  }, [post, editorialDraft, projectTitle]);

  // This component doesn't render anything
  return null;
}


