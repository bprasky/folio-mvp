'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { HeroSpreadBlock } from './HeroSpreadBlock';
import { EditorialSpread } from './EditorialSpread';
import { SplitEditorialBlock } from './SplitEditorialBlock';
import { GalleryBlock } from './GalleryBlock';
import { DetailBlock } from './DetailBlock';
import { ProductInsertBlock } from './ProductInsertBlock';
import { TextInterludeBlock } from './TextInterludeBlock';
import { PullQuoteBlock } from './PullQuoteBlock';
import { EditorialPullQuote } from './EditorialPullQuote';
import { ScrollCinematic } from './ScrollCinematic';
import { EditorialProductFloat } from './EditorialProductFloat';
import { generateEditorialLayout, generateEditorialLayoutFromDraft, EditorialBlock } from './layoutEngine';
import { roomPriority } from './roomPriority';
import type { Blocks } from '@/lib/posting/schemas';
import type { EditorialProjectImage as ProjectImage } from '@/types/editorial';

interface Project {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  regionState?: string | null;
}

interface Room {
  id: string;
  name: string;
  type?: string | null;
}

interface EditorialProjectLayoutProps {
  project: Project;
  images: ProjectImage[];
  rooms?: Room[];
  editorialDraft?: Blocks;
  draftError?: Error;
  mode?: 'published' | 'edit';
}

/**
 * EditorialProjectLayout - Magazine-style editorial spread
 * 
 * Uses deterministic layout engine to create varied, rhythmic layouts
 * that feel like a design magazine, not a checkerboard grid.
 * 
 * Design principles:
 * - Editorial > feed
 * - White space > density
 * - Curation > completeness
 * - Subtle motion > interaction noise
 * - Quiet luxury > tech flash
 */
export function EditorialProjectLayout({ 
  project, 
  images, 
  rooms = [],
  editorialDraft,
  draftError,
  mode = 'published'
}: EditorialProjectLayoutProps) {
  // 🔍 DEBUG: Log what EditorialProjectLayout receives
  console.log('[EditorialProjectLayout] Rendering with:', {
    projectId: project.id,
    projectTitle: project.title,
    mode,
    hasEditorialDraft: !!editorialDraft,
    hasDraftError: !!draftError,
    draftError: draftError?.message,
    editorialDraftKeys: editorialDraft ? Object.keys(editorialDraft) : [],
    leadKicker: editorialDraft?.lead?.kicker,
    leadDeck: editorialDraft?.lead?.deck,
    leadDeckLength: editorialDraft?.lead?.deck?.length,
    galleryChaptersCount: editorialDraft?.galleryChapters?.length || 0,
    firstChapterBodyLength: editorialDraft?.galleryChapters?.[0]?.body?.length || 0,
    imagesCount: images.length,
    roomsCount: rooms.length,
  });
  // Create room lookup map (ID/name -> display name)
  const roomMap = useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach(room => {
      map.set(room.id, room.name);
      map.set(room.name.toLowerCase(), room.name);
      if (room.name) {
        map.set(room.name, room.name);
      }
    });
    return map;
  }, [rooms]);

  // Create room data map for text generation
  const roomDataMap = useMemo(() => {
    const map = new Map<string, { name: string; description?: string | null; notes?: string | null; type?: string | null }>();
    rooms.forEach(room => {
      map.set(room.id, {
        name: room.name,
        description: (room as any).description || null,
        notes: (room as any).notes || null,
        type: room.type || null,
      });
    });
    return map;
  }, [rooms]);

  // Generate editorial layout
  // For published mode with draft: use narrative-first layout
  // For edit mode or no draft: use image-based layout
  const blocks = useMemo(() => {
    // Published mode MUST use draft (if available)
    if (mode === 'published' && editorialDraft) {
      const result = generateEditorialLayoutFromDraft(editorialDraft, images, {
        projectTitle: project.title,
        roomMap,
      });
      
      if (process.env.NODE_ENV !== 'production') {
        const chapterDetails = editorialDraft.galleryChapters?.map(ch => ({
          title: ch.title,
          paragraphCount: ch.body?.length || 0,
          imageCount: ch.imageIds?.length || 0,
          totalChars: ch.body?.reduce((sum, p) => sum + p.length, 0) || 0,
        })) || [];
        
        console.debug('[EditorialLayout] Using draft-based layout', {
          chapters: editorialDraft.galleryChapters?.length || 0,
          chapterDetails,
          blocks: result.map(b => b.type),
          blockCount: result.length,
          imageCount: images.length,
          tagsPerImage: images.map(img => ({
            imageId: img.id,
            tagCount: img.tags?.length || 0,
            tagsWithCoords: img.tags?.filter(t => typeof t.x === 'number' && typeof t.y === 'number').length || 0,
          })),
        });
      }
      
      return result;
    }
    
    // Fallback: image-based layout (for edit mode or when draft is missing)
    const result = generateEditorialLayout(images, {
      projectTitle: project.title,
      projectDescription: project.description,
      roomMap,
      roomDataMap,
      minImagesForSparse: 6,
      maxProductInserts: 2,
    });
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[EditorialLayout] Using image-based layout', {
        blocks: result.map(b => b.type),
        blockCount: result.length,
      });
    }
    
    return result;
  }, [images, project.title, project.description, roomMap, roomDataMap, editorialDraft, mode]);

  // Show generating state if draft is missing in published mode
  if (mode === 'published' && !editorialDraft && !draftError) {
    return (
      <div className="w-full bg-surface-canvas min-h-screen">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-serif font-light text-folio-text-primary">
              {project.title}
            </h1>
            <p className="text-lg text-folio-text-secondary">
              Editorial is generating... Please refresh in a moment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if draft generation failed
  if (mode === 'published' && draftError) {
    return (
      <div className="w-full bg-surface-canvas min-h-screen">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-serif font-light text-folio-text-primary">
              {project.title}
            </h1>
            <p className="text-lg text-folio-text-secondary">
              Editorial generation encountered an issue. Please try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="w-full py-24 text-center text-folio-text-secondary">
        <p className="text-lg">No images available for this project.</p>
      </div>
    );
  }

  // Animation variants for scroll-in
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-100px' },
    transition: { duration: 0.6, ease: 'easeOut' },
  };

  // Find hero block for debug panel
  const heroBlock = blocks.find(b => b.type === 'hero');

  return (
    <div className="w-full bg-surface-canvas min-h-screen">
      {/* 12-column grid system - magazine layout */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 gap-x-6">
          {blocks.map((block, index) => {
            const key = `${block.type}-${index}-${'image' in block ? block.image.id : 'images' in block ? block.images.map(i => i.id).join('-') : 'text'}`;
            const isHero = block.type === 'hero';
            const isMidpoint = index === Math.floor(blocks.length / 2);
            
            return (
              <div key={key} className="col-span-12">
                <motion.div {...fadeInUp}>
                  {renderBlock(block, project, index, mode)}
                </motion.div>
                {/* Insert pullquote after hero block, and once more at midpoint */}
                {(isHero || (isMidpoint && index > 2)) && (
                  <PullQuoteBlock projectId={project.id} index={index} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Debug Panel - Dev Only */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded-lg font-mono z-50 backdrop-blur-sm max-w-xs">
            <div className="space-y-1">
              <div>
                <span className="text-folio-text-tertiary">Hero:</span>{' '}
                <span className="text-white">{heroBlock?.roomName || 'none'}</span>
              </div>
              <div>
                <span className="text-folio-text-tertiary">Rooms:</span>{' '}
                <span className="text-white">
                  {Array.from(new Set(
                    blocks
                      .filter(b => 'roomName' in b && b.roomName)
                      .map(b => (b as any).roomName)
                  )).join(' > ')}
                </span>
              </div>
              <div>
                <span className="text-folio-text-tertiary">Blocks:</span>{' '}
                <span className="text-white">{blocks.map(b => b.type).join(', ')}</span>
              </div>
              <div>
                <span className="text-folio-text-tertiary">Count:</span>{' '}
                <span className="text-white">{blocks.length} blocks, {images.length} images</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Render a single editorial block
 */
function renderBlock(block: EditorialBlock, project: Project, index: number, mode: 'published' | 'edit' = 'published') {
  switch (block.type) {
    case 'hero':
      return (
        <HeroSpreadBlock
          image={block.image}
          project={project}
          roomName={block.roomName || null}
          showTitle={block.showTitle}
        />
      );
    
    case 'spread':
      return (
        <EditorialSpread
          image={block.image}
          roomName={block.roomName}
          editorialText={block.editorialText}
          isHeroAdjacent={block.isHeroAdjacent}
        />
      );
    
    case 'split':
      return (
        <SplitEditorialBlock
          image={block.image}
          roomName={block.roomName || null}
          editorialText={block.editorialText || null}
          alignment={block.alignment}
        />
      );
    
    case 'gallery':
      return (
        <GalleryBlock
          images={block.images}
          roomName={block.roomName || null}
        />
      );
    
    case 'detail':
      return (
        <DetailBlock
          image={block.image}
          caption={block.caption || null}
          roomName={block.roomName || null}
        />
      );
    
    case 'productInsert':
      return (
        <ProductInsertBlock
          products={block.products}
          roomName={block.roomName || null}
          isBoosted={block.isBoosted}
          featuredQuestions={block.featuredQuestions}
          mode={mode}
        />
      );
    
    case 'textInterlude':
      return (
        <TextInterludeBlock
          roomName={block.roomName || null}
          text={block.text}
        />
      );

    case 'pullQuote':
      return (
        <EditorialPullQuote
          text={block.text}
          attribution={block.attribution}
        />
      );

    case 'scrollCinematic':
      return (
        <ScrollCinematic
          image={block.image}
          meshTags={block.meshTags}
          roomName={block.roomName}
        />
      );

    case 'productFloat':
      return (
        <EditorialProductFloat
          products={block.products}
          roomName={block.roomName}
        />
      );

    default:
      return null;
  }
}
