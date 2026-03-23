import { formatRoomName } from '@/lib/utils/formatRoomName';

/**
 * layoutEngine.ts - Deterministic editorial layout engine
 * 
 * INPUTS:
 * - images: Array of { id, url, name?, room?, tags? }
 * - options: { projectTitle, projectDescription?, roomMap, roomDataMap?, minImagesForSparse, maxProductInserts }
 * 
 * RETURNS:
 * - Array of EditorialBlock objects
 * 
 * BLOCK TYPES:
 * - hero: { type: 'hero', image, roomName?, showTitle: boolean } - REQUIRES image
 * - spread: { type: 'spread', image, roomName, editorialText, isHeroAdjacent? } - REQUIRES image AND roomName AND text
 * - split: { type: 'split', image, roomName?, editorialText?, alignment } - REQUIRES image AND text
 * - gallery: { type: 'gallery', images[], roomName? } - REQUIRES 2-3 images
 * - detail: { type: 'detail', image, caption?, roomName? } - REQUIRES image
 * - productInsert: { type: 'productInsert', products[], roomName?, isBoosted? } - Can be placeholder
 * - textInterlude: { type: 'textInterlude', roomName?, text } - REQUIRES text
 * - pullQuote: { type: 'pullQuote', text, attribution? } - REQUIRES text
 * 
 * OPTIONAL FIELDS:
 * - roomName: string | undefined (derived from roomMap)
 * - editorialText: string | undefined (generated with fallbacks)
 * - caption: string | undefined (generated with fallbacks)
 * - showTitle: boolean (only true for first hero)
 */

export interface ClassifiedImage {
  id: string;
  url: string;
  name?: string | null;
  room?: string | null;
  tags?: Array<{
    id: string;
    x?: number;
    y?: number;
    product?: {
      id: string;
      name: string;
      imageUrl?: string | null;
      primaryImageUrl?: string | null;
      imageUrls?: string[];
      thumbnailUrl?: string | null;
    } | null;
  }>;
  // Classification
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown';
  isWideCandidate: boolean;
  shotType: 'wide' | 'detail';
}

export type EditorialBlock =
  | { type: 'hero'; image: ClassifiedImage; roomName?: string; showTitle: boolean; imageIds: string[] }
  | { type: 'spread'; image: ClassifiedImage; roomName: string; editorialText: string; isHeroAdjacent?: boolean; imageIds: string[] }
  | { type: 'split'; image: ClassifiedImage; roomName?: string; editorialText?: string; alignment: 'left' | 'right'; imageIds: string[] }
  | { type: 'gallery'; images: ClassifiedImage[]; roomName?: string; imageIds: string[] }
  | { type: 'detail'; image: ClassifiedImage; caption?: string; roomName?: string; imageIds: string[] }
  | { type: 'productInsert'; products: Array<{ id: string; name: string; imageUrl?: string | null; primaryImageUrl?: string | null; imageUrls?: string[]; thumbnailUrl?: string | null }>; roomName?: string; isBoosted?: boolean; featuredQuestions?: Array<{ productId: string; questions: string[] }>; imageIds?: string[] }
  | { type: 'textInterlude'; roomName?: string; text: string; imageIds?: string[] }
  | { type: 'pullQuote'; text: string; attribution?: string; imageIds?: string[] };

interface LayoutEngineOptions {
  projectTitle: string;
  projectDescription?: string | null;
  roomMap: Map<string, string>; // room ID/name -> display name
  roomDataMap?: Map<string, { name: string; description?: string | null; notes?: string | null; type?: string | null }>; // room ID -> full room data
  minImagesForSparse: number;
  maxProductInserts: number;
}

import { generateEditorialText as getEditorialText, getProjectIntroText } from './textHelpers';
import { roomPriority, groupImagesByRoom } from './roomPriority';
import { normalizePullQuote, getSelectedPullQuoteText, getSelectedPullQuoteContext, type Blocks } from '@/lib/posting/schemas';

/**
 * Classify an image based on available metadata or heuristics
 */
function classifyImage(
  image: {
    id: string;
    url: string;
    name?: string | null;
    room?: string | null;
    tags?: Array<{ id: string; x?: number; y?: number; product?: { id: string; name: string; imageUrl?: string | null; primaryImageUrl?: string | null; imageUrls?: string[]; thumbnailUrl?: string | null } | null }>;
  },
  index: number,
  total: number
): ClassifiedImage {
  let orientation: 'landscape' | 'portrait' | 'square' | 'unknown' = 'unknown';
  let isWideCandidate = false;
  
  if (image.name) {
    const nameLower = image.name.toLowerCase();
    if (nameLower.includes('wide') || nameLower.includes('landscape') || nameLower.includes('panorama')) {
      orientation = 'landscape';
      isWideCandidate = true;
    } else if (nameLower.includes('portrait') || nameLower.includes('vertical')) {
      orientation = 'portrait';
    } else if (nameLower.includes('square')) {
      orientation = 'square';
    }
  }
  
  if (orientation === 'unknown') {
    if (index === 0 || (index > 0 && index % 4 === 0)) {
      orientation = 'landscape';
      isWideCandidate = true;
    } else {
      orientation = index % 3 === 0 ? 'square' : 'portrait';
    }
  }
  
  if (orientation === 'landscape' && !isWideCandidate) {
    isWideCandidate = index === 0 || (index > 0 && index % 4 === 0);
  }
  
  const shotType: 'wide' | 'detail' = isWideCandidate ? 'wide' : 'detail';
  
  return {
    ...image,
    orientation,
    isWideCandidate,
    shotType,
  };
}

/**
 * Get room name for an image
 */
function getRoomName(image: ClassifiedImage, roomMap: Map<string, string>): string | undefined {
  if (!image.room) return undefined;
  return roomMap.get(image.room) || roomMap.get(image.room.toLowerCase()) || formatRoomName(image.room);
}

/**
 * Extract products from image tags
 */
function extractProducts(image: ClassifiedImage): Array<{ id: string; name: string; imageUrl?: string | null; primaryImageUrl?: string | null; imageUrls?: string[]; thumbnailUrl?: string | null }> {
  return image.tags
    ?.filter(tag => tag.product?.name)
    .map(tag => ({
      id: tag.product!.id,
      name: tag.product!.name,
      imageUrl: tag.product!.imageUrl || null,
      primaryImageUrl: tag.product!.primaryImageUrl || null,
      imageUrls: tag.product!.imageUrls || [],
      thumbnailUrl: tag.product!.thumbnailUrl || null,
    })) || [];
}

/**
 * Check if product has a usable image (evidence requirement)
 */
function productHasImage(product: { imageUrl?: string | null; primaryImageUrl?: string | null; imageUrls?: string[]; thumbnailUrl?: string | null }): boolean {
  return !!(product.imageUrl || product.primaryImageUrl || (product.imageUrls && product.imageUrls.length > 0) || product.thumbnailUrl);
}

/**
 * Get aspect ratio from image orientation
 */
function getAspect(image: ClassifiedImage): 'portrait' | 'landscape' | 'square' {
  if (image.orientation === 'portrait') return 'portrait';
  if (image.orientation === 'square') return 'square';
  return 'landscape'; // Default to landscape
}

/**
 * Choose room lead block type based on image count
 */
function chooseRoomLeadBlockType(roomImages: ClassifiedImage[]): 'gallery' | 'spread' | 'detail' {
  if (roomImages.length >= 3) return 'gallery';
  if (roomImages.length === 2) return 'spread';
  return 'detail';
}

/**
 * Choose body block type based on aspect and caption text
 */
function chooseBodyBlockType(image: ClassifiedImage, hasCaptionText: boolean): 'split' | 'detail' {
  const aspect = getAspect(image);
  if (aspect === 'landscape' && hasCaptionText) return 'split';
  return 'detail';
}

/**
 * Build featured questions for a product
 */
function buildFeaturedQuestions(productName: string, roomName?: string | null): string[] {
  return [
    `Why was ${productName} the right choice for ${roomName || 'this space'}?`,
    `What finish/size/spec should someone know before buying?`,
    `What was the key design goal this piece solved (contrast, warmth, sculptural, continuity)?`,
  ];
}

/**
 * Score a hero candidate image
 */
function scoreHeroCandidate(
  image: ClassifiedImage,
  roomName: string | undefined,
  index: number
): number {
  let score = 0;
  const roomLower = (roomName || '').toLowerCase();
  
  if (roomLower.includes('exterior') || roomLower.includes('outdoor')) {
    score += 3;
  }
  
  if (roomLower === 'exterior' || roomLower === 'entry' || roomLower === 'living' || roomLower === 'living room' || roomLower === 'great room') {
    score += 2;
  }
  
  if (image.isWideCandidate && image.orientation === 'landscape') {
    score += 2;
  }
  
  if (index < 3) {
    score += 1;
  }
  
  if (roomLower.includes('kitchen')) {
    score -= 2;
  }
  
  return score;
}

/**
 * Main layout engine - pure function
 * 
 * NEW APPROACH: Group by room, sort by priority, process room-by-room
 */
export function generateEditorialLayout(
  images: Array<{
    id: string;
    url: string;
    name?: string | null;
    room?: string | null;
    tags?: Array<{ id: string; product?: { id: string; name: string; imageUrl?: string | null; primaryImageUrl?: string | null; imageUrls?: string[]; thumbnailUrl?: string | null } | null }>;
  }>,
  options: LayoutEngineOptions
): EditorialBlock[] {
  const { projectTitle, projectDescription, roomMap, roomDataMap, minImagesForSparse, maxProductInserts } = options;
  
  if (images.length === 0) {
    return [];
  }
  
  // Classify all images
  const classified = images.map((img, idx) => classifyImage(img, idx, images.length));
  
  // 1.2 Group images by room and sort by priority
  const roomGroups = groupImagesByRoom(classified, roomMap);
  
  // 2.1 Hero Scoring - Find best hero candidate from first 6 images
  const heroCandidates = classified.slice(0, Math.min(6, classified.length));
  const heroScores = heroCandidates.map((img, idx) => ({
    image: img,
    index: idx,
    score: scoreHeroCandidate(img, getRoomName(img, roomMap), idx),
  }));
  
  heroScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });
  
  const selectedHero = heroScores[0];
  const heroImageId = selectedHero.image.id;
  const heroRoomName = getRoomName(selectedHero.image, roomMap);
  
  const blocks: EditorialBlock[] = [];
  const isSparse = images.length < minImagesForSparse;
  const projectIntroText = getProjectIntroText({ description: projectDescription || null, title: projectTitle });
  
  // Sparse projects: Add intro text only if absolutely necessary (no room images)
  // Otherwise, let spreads handle the text
  if (isSparse && roomGroups.length === 0) {
    blocks.push({
      type: 'textInterlude',
      text: projectIntroText,
    });
  }
  
  // Add hero block
  blocks.push({
    type: 'hero',
    image: selectedHero.image,
    roomName: heroRoomName,
    showTitle: true,
    imageIds: [selectedHero.image.id],
  });
  
  // Track which rooms have been processed
  const processedRooms = new Set<string | null>();
  processedRooms.add(heroRoomName || null);
  let lastBlockType: EditorialBlock['type'] | null = 'hero';
  let roomCount = 0; // For rhythm-based text interlude
  
  // 1.3 Kitchen Deferral: Ensure kitchen doesn't appear first unless it's the hero
  // Process room groups in priority order
  for (const roomGroup of roomGroups) {
    // For hero room, process remaining images (hero already added)
    // For other rooms, process all images
    const roomImages = roomGroup.images.filter(img => img.id !== heroImageId);
    
    // HARD RULE: Skip if no images left to process (room must have at least 1 displayed image)
    if (roomImages.length === 0) {
      continue;
    }
    
    // If this is the hero room, mark it as processed but still process remaining images
    if (roomGroup.roomName === heroRoomName) {
      // Process remaining images in hero room (don't skip entirely)
      // This ensures all images in the hero room are shown
    }
    
    // 1.3 Kitchen Deferral Rule: If kitchen would be first non-hero room, defer it
    if (processedRooms.size === 1 && roomPriority(roomGroup.roomName) <= 1) {
      // Look for a higher priority room group that hasn't been processed yet
      const higherPriorityRoom = roomGroups.find(
        rg => rg.roomName !== heroRoomName && 
        rg.roomName !== roomGroup.roomName && 
        !processedRooms.has(rg.roomName) &&
        roomPriority(rg.roomName) > roomPriority(roomGroup.roomName) &&
        rg.images.length > 0
      );
      
      if (higherPriorityRoom) {
        // Process higher priority room first
        const higherRoomImages = higherPriorityRoom.images.filter(img => img.id !== heroImageId);
        if (higherRoomImages.length > 0) {
          const higherResult = processRoomGroup(higherPriorityRoom.roomName, higherRoomImages, blocks, {
            roomMap,
            roomDataMap,
            projectDescription,
            processedRooms,
            productInsertCount,
            productInsertsByRoom,
            maxProductInserts,
            isSparse,
            lastBlockType,
            splitAlignment,
          });
          
          // Update state
          processedRooms.add(higherPriorityRoom.roomName);
          productInsertCount = higherResult.productInsertCount;
          lastBlockType = higherResult.lastBlockType;
          splitAlignment = higherResult.splitAlignment;
        }
        // Continue to process current room group after higher priority room
      }
    }
    
    // Skip if this room was already processed (e.g., in kitchen deferral)
    if (processedRooms.has(roomGroup.roomName)) {
      continue;
    }
    
    // Process this room group (roomImages already filtered above)
    const result = processRoomGroup(roomGroup.roomName, roomImages, blocks, {
      roomMap,
      roomDataMap,
      projectDescription,
      processedRooms,
      isSparse,
      lastBlockType,
      roomCount,
    });
    
    processedRooms.add(roomGroup.roomName);
    lastBlockType = result.lastBlockType;
    roomCount = result.roomCount;
  }
  
  // Compute displayed image IDs
  const displayedImageIds = new Set<string>();
  blocks.forEach(block => {
    if ('imageIds' in block && block.imageIds) {
      block.imageIds.forEach(id => displayedImageIds.add(id));
    }
  });

  // Build map of imageId -> products from displayed images only
  const imageIdToProducts = new Map<string, Array<{ id: string; name: string; imageUrl?: string | null; primaryImageUrl?: string | null; imageUrls?: string[]; thumbnailUrl?: string | null }>>();
  classified.forEach(img => {
    if (displayedImageIds.has(img.id)) {
      const products = extractProducts(img);
      if (products.length > 0) {
        imageIdToProducts.set(img.id, products);
      }
    }
  });

  // Build roomName -> featuredCandidates map (only from displayed images)
  // Use image.room to get the correct room name via roomMap
  const roomFeaturedCandidates = new Map<string | null, Array<{ id: string; name: string; imageUrl?: string | null; primaryImageUrl?: string | null; imageUrls?: string[]; thumbnailUrl?: string | null }>>();
  blocks.forEach(block => {
    if (('imageIds' in block && block.imageIds && block.imageIds.length > 0) || ('image' in block && block.image)) {
      const imageIds = 'imageIds' in block && block.imageIds ? block.imageIds : ('image' in block ? [block.image.id] : []);
      
      imageIds.forEach(imageId => {
        if (!imageId) return;
        const products = imageIdToProducts.get(imageId) || [];
        if (products.length === 0) return;
        
        // Find the image to get its room property
        const image = classified.find(img => img.id === imageId);
        if (!image) return;
        
        // Get room name from image.room using roomMap (same logic as getRoomName)
        const imageRoomName = getRoomName(image, roomMap);
        const roomName = imageRoomName || ('roomName' in block ? (block.roomName || null) : null);
        
        products.forEach(product => {
          // Only include products with images (evidence requirement)
          if (productHasImage(product)) {
            if (!roomFeaturedCandidates.has(roomName)) {
              roomFeaturedCandidates.set(roomName, []);
            }
            const existing = roomFeaturedCandidates.get(roomName)!;
            // Deduplicate by product.id
            if (!existing.find(p => p.id === product.id)) {
              existing.push(product);
            }
          }
        });
      });
    }
  });

  // Insert product blocks after room lead blocks (only if eligible)
  const blocksWithProducts: EditorialBlock[] = [];
  let productInsertCount = 0;
  const roomsWithProductInsert = new Set<string | null>(); // Track which rooms already have product inserts
  
  blocks.forEach((block, index) => {
    blocksWithProducts.push(block);
    
    // Insert product block after room lead (spread/gallery/detail that starts a room)
    if ((block.type === 'spread' || block.type === 'gallery' || block.type === 'detail') && 
        productInsertCount < maxProductInserts) {
      
      // Get room name from block's image(s)
      let blockRoomName: string | null = null;
      if ('image' in block) {
        blockRoomName = getRoomName(block.image, roomMap) || block.roomName || null;
      } else if ('images' in block && block.images.length > 0) {
        blockRoomName = getRoomName(block.images[0], roomMap) || block.roomName || null;
      } else {
        blockRoomName = block.roomName || null;
      }
      
      // Skip if room already has product insert or no room name
      if (!blockRoomName || roomsWithProductInsert.has(blockRoomName)) {
        return;
      }
      
      const candidates = roomFeaturedCandidates.get(blockRoomName) || [];
      if (candidates.length > 0) {
        const featuredProducts = candidates.slice(0, 3);
        const featuredQuestions = featuredProducts.map(product => ({
          productId: product.id,
          questions: buildFeaturedQuestions(product.name, blockRoomName),
        }));
        
        blocksWithProducts.push({
          type: 'productInsert',
          products: featuredProducts,
          roomName: blockRoomName,
          isBoosted: false,
          featuredQuestions,
          imageIds: [],
        });
        productInsertCount++;
        roomsWithProductInsert.add(blockRoomName);
      }
    }
  });

  // Block validation - ensure all blocks have required content
  const validatedBlocks = blocksWithProducts.map(block => {
    // Ensure split blocks always have text
    if (block.type === 'split' && (!block.editorialText || block.editorialText.trim().length === 0)) {
      const roomData = block.roomName && roomDataMap ? roomDataMap.get(block.image.room || '') : null;
      return {
        ...block,
        editorialText: getEditorialText(block.roomName, projectDescription, roomData || undefined),
      };
    }
    // Ensure text interlude blocks always have text
    if (block.type === 'textInterlude' && (!block.text || block.text.trim().length === 0)) {
      const roomData = block.roomName && roomDataMap ? roomDataMap.get(block.roomName) : null;
      return {
        ...block,
        text: getEditorialText(block.roomName, projectDescription, roomData || undefined),
      };
    }
    // Convert invalid galleries to detail blocks (don't lose images)
    if (block.type === 'gallery' && (!block.images || block.images.length < 2)) {
      if (block.images && block.images.length === 1) {
        const roomData = block.roomName && roomDataMap ? roomDataMap.get(block.images[0].room || '') : null;
        const editorialText = getEditorialText(block.roomName, projectDescription, roomData || undefined);
        const aspect = getAspect(block.images[0]);
        const hasText = editorialText && editorialText.trim().length > 0;
        const blockType = chooseBodyBlockType(block.images[0], hasText);
        
        if (blockType === 'split') {
          return {
            type: 'split' as const,
            image: block.images[0],
            roomName: block.roomName,
            editorialText,
            alignment: aspect === 'portrait' ? 'left' : 'right' as 'left' | 'right',
            imageIds: [block.images[0].id],
          };
        } else {
          return {
            type: 'detail' as const,
            image: block.images[0],
            caption: editorialText || undefined,
            roomName: block.roomName,
            imageIds: [block.images[0].id],
          };
        }
      }
      // If no images, convert to text interlude
      const roomData = block.roomName && roomDataMap ? roomDataMap.get(block.roomName) : null;
      return {
        type: 'textInterlude' as const,
        roomName: block.roomName,
        text: getEditorialText(block.roomName, projectDescription, roomData || undefined),
        imageIds: [],
      };
    }
    
    // Ensure all blocks have imageIds
    if ('image' in block && !('imageIds' in block)) {
      return { ...block, imageIds: [block.image.id] };
    }
    if ('images' in block && !('imageIds' in block)) {
      return { ...block, imageIds: block.images.map(img => img.id) };
    }
    if (!('imageIds' in block)) {
      return { ...block, imageIds: [] };
    }
    
    return block;
  }).filter(block => {
    // Only filter out blocks that truly cannot be rendered
    // Never filter out image blocks - they should always be converted, not removed
    if (block.type === 'hero' && !block.image) return false;
    if (block.type === 'spread' && !block.image) return false;
    if (block.type === 'split' && !block.image) return false;
    if (block.type === 'detail' && !block.image) return false;
    if (block.type === 'gallery' && (!block.images || block.images.length === 0)) return false;
    // Text blocks should always have text (already ensured above)
    if (block.type === 'textInterlude' && (!block.text || block.text.trim().length === 0)) return false;
    if (block.type === 'pullQuote' && (!block.text || block.text.trim().length === 0)) return false;
    return true;
  });
  
  // Debug: Verify all images are accounted for
  if (process.env.NODE_ENV !== 'production') {
    const usedImageIds = new Set<string>();
    validatedBlocks.forEach(block => {
      if ('image' in block) {
        usedImageIds.add(block.image.id);
      }
      if ('images' in block) {
        block.images.forEach(img => usedImageIds.add(img.id));
      }
    });
    
    const missingImages = classified.filter(img => !usedImageIds.has(img.id));
    if (missingImages.length > 0) {
      console.warn('[EditorialLayout] Missing images:', missingImages.map(img => ({ id: img.id, room: img.room })));
    }
  }
  
  return validatedBlocks;
}

/**
 * Process a room group - creates room lead block + subsequent blocks
 */
function processRoomGroup(
  roomName: string | null,
  roomImages: ClassifiedImage[],
  blocks: EditorialBlock[],
  context: {
    roomMap: Map<string, string>;
    roomDataMap?: Map<string, { name: string; description?: string | null; notes?: string | null; type?: string | null }>;
    projectDescription?: string | null;
    processedRooms: Set<string | null>;
    isSparse: boolean;
    lastBlockType: EditorialBlock['type'] | null;
    roomCount: number;
  }
): { lastBlockType: EditorialBlock['type'] | null; roomCount: number } {
  if (roomImages.length === 0) {
    return { lastBlockType: context.lastBlockType, roomCount: context.roomCount };
  }
  
  const { roomDataMap, projectDescription, lastBlockType, roomCount } = context;
  let currentLastBlockType = lastBlockType;
  let currentRoomCount = roomCount;
  
  // Choose room lead block type based on image count
  const leadBlockType = chooseRoomLeadBlockType(roomImages);
  const firstImage = roomImages[0];
  const roomData = roomName && roomDataMap ? roomDataMap.get(firstImage.room || '') : null;
  const editorialText = getEditorialText(roomName, projectDescription, roomData || undefined);
  const isHeroAdjacent = context.processedRooms.size === 1;
  
  // Create room lead block
  if (leadBlockType === 'gallery') {
    // Gallery: take first 3 images
    const galleryImages = roomImages.slice(0, 3);
    blocks.push({
      type: 'gallery',
      images: galleryImages,
      roomName: roomName || undefined,
      imageIds: galleryImages.map(img => img.id),
    });
    currentLastBlockType = 'gallery';
  } else if (leadBlockType === 'spread') {
    // Spread: use first 2 images (or just first if only 2 total)
    const spreadImage = roomImages[0];
    blocks.push({
      type: 'spread',
      image: spreadImage,
      roomName: roomName || 'Unknown',
      editorialText,
      isHeroAdjacent,
      imageIds: [spreadImage.id],
    });
    currentLastBlockType = 'spread';
  } else {
    // Detail: single image
    blocks.push({
      type: 'detail',
      image: firstImage,
      caption: editorialText || undefined,
      roomName: roomName || undefined,
      imageIds: [firstImage.id],
    });
    currentLastBlockType = 'detail';
  }
  
  // Process remaining images in room
  const remainingImages = leadBlockType === 'gallery' ? roomImages.slice(3) : roomImages.slice(1);
  for (const image of remainingImages) {
    const roomData = roomName && roomDataMap ? roomDataMap.get(image.room || '') : null;
    const editorialText = getEditorialText(roomName, projectDescription, roomData || undefined);
    const hasText = editorialText && editorialText.trim().length > 0;
    
    // Choose block type based on aspect and text
    const blockType = chooseBodyBlockType(image, hasText);
    
    if (blockType === 'split') {
      // Use aspect to determine alignment (portrait = left, landscape = right)
      const aspect = getAspect(image);
      const alignment = aspect === 'portrait' ? 'left' : 'right';
      
      blocks.push({
        type: 'split',
        image,
        roomName: roomName || undefined,
        editorialText,
        alignment,
        imageIds: [image.id],
      });
      currentLastBlockType = 'split';
    } else {
      blocks.push({
        type: 'detail',
        image,
        caption: editorialText || undefined,
        roomName: roomName || undefined,
        imageIds: [image.id],
      });
      currentLastBlockType = 'detail';
    }
  }
  
  // Rhythm rule: Every 2 rooms, insert text interlude if we have project/room text
  currentRoomCount++;
  if (currentRoomCount % 2 === 0 && projectDescription && projectDescription.trim().length > 0) {
    blocks.push({
      type: 'textInterlude',
      text: projectDescription, // Full text, no truncation
      imageIds: [],
    });
  }
  
  return {
    lastBlockType: currentLastBlockType,
    roomCount: currentRoomCount,
  };
}

/**
 * Generate editorial layout from draft blocks (narrative-first approach)
 * 
 * This is the PRIMARY layout function for published posts.
 * It uses the editorial draft's chapters to create a narrative-driven layout.
 */
export function generateEditorialLayoutFromDraft(
  draft: Blocks,
  images: Array<{
    id: string;
    url: string;
    name?: string | null;
    room?: string | null;
    tags?: Array<{ id: string; x?: number; y?: number; product?: { id: string; name: string; imageUrl?: string | null; primaryImageUrl?: string | null; imageUrls?: string[]; thumbnailUrl?: string | null } | null }>;
  }>,
  options: {
    projectTitle: string;
    roomMap: Map<string, string>;
  }
): EditorialBlock[] {
  const { projectTitle, roomMap } = options;
  
  if (images.length === 0) {
    return [];
  }

  // Create image lookup map
  const imageMap = new Map(images.map(img => [img.id, img]));
  
  // Classify all images
  const classified = images.map((img, idx) => classifyImage(img, idx, images.length));
  const classifiedMap = new Map(classified.map(img => [img.id, img]));

  const blocks: EditorialBlock[] = [];

  // 1. Lead block (hero or text interlude)
  // If we have chapters, use lead deck as text interlude (no hero to avoid duplicate)
  // If no chapters, use first image as hero
  if (draft.galleryChapters && draft.galleryChapters.length > 0) {
    // We have chapters - render lead deck as text interlude, skip hero
    if (draft.lead?.deck) {
      blocks.push({
        type: 'textInterlude',
        text: draft.lead.deck,
        imageIds: [],
      });
    }
    // Render introduction paragraphs after lead deck, before gallery chapters
    if (draft.introduction && draft.introduction.length > 0) {
      for (const para of draft.introduction) {
        blocks.push({
          type: 'textInterlude',
          text: para,
          imageIds: [],
        });
      }
    }
  } else {
    // No chapters - use first image as hero
    const heroImage = classified[0];
    if (heroImage) {
      const heroRoomName = getRoomName(heroImage, roomMap);
      blocks.push({
        type: 'hero',
        image: heroImage,
        roomName: heroRoomName,
        showTitle: true,
        imageIds: [heroImage.id],
      });

      // Add lead text as text interlude after hero (if exists)
      if (draft.lead?.deck) {
        blocks.push({
          type: 'textInterlude',
          text: draft.lead.deck,
          imageIds: [],
        });
      }
    }
  }

  // 2. Process gallery chapters (narrative-driven)
  const usedPullQuoteTexts = new Set<string>(); // Prevent duplicate pull quotes
  if (draft.galleryChapters && draft.galleryChapters.length > 0) {
    for (let chapterIndex = 0; chapterIndex < draft.galleryChapters.length; chapterIndex++) {
      const chapter = draft.galleryChapters[chapterIndex];
      if (!chapter || !chapter.imageIds || chapter.imageIds.length === 0) continue;

      // Get images for this chapter
      const chapterImages = chapter.imageIds
        .map(id => classifiedMap.get(id))
        .filter((img): img is ClassifiedImage => img !== undefined);

      if (chapterImages.length === 0) continue;

      // Chapter lead: Split spread with narrative text
      const leadImage = chapterImages[0];
      const chapterTitle = chapter.title || undefined;
      const chapterBody = chapter.body || [];
      
      // Use ALL paragraphs, no truncation
      // Join with double newline for proper paragraph breaks
      const narrativeText = chapterBody.length >= 2 
        ? chapterBody.join('\n\n') 
        : chapterBody[0] || undefined;

      // Determine room name from first image
      const chapterRoomName = getRoomName(leadImage, roomMap);

      // Only create split block if we have substantial text (2+ paragraphs or 1 long paragraph)
      if (narrativeText && narrativeText.trim().length > 100) {
        blocks.push({
          type: 'split',
          image: leadImage,
          roomName: chapterTitle || chapterRoomName,
          editorialText: narrativeText,
          alignment: 'right', // Image on right, text on left
          imageIds: [leadImage.id],
        });
      } else {
        // If text is too short, create a detail block instead
        blocks.push({
          type: 'detail',
          image: leadImage,
          roomName: chapterTitle || chapterRoomName,
          caption: narrativeText || undefined,
          imageIds: [leadImage.id],
        });
      }

      // Additional images in chapter: mosaic or detail blocks
      if (chapterImages.length > 1) {
        const remainingImages = chapterImages.slice(1);
        
        if (remainingImages.length >= 2) {
          // Gallery block for 2+ images
          blocks.push({
            type: 'gallery',
            images: remainingImages.slice(0, 3), // Max 3 in gallery
            roomName: chapterTitle || chapterRoomName,
            imageIds: remainingImages.slice(0, 3).map(img => img.id),
          });
        } else {
          // Single detail block
          blocks.push({
            type: 'detail',
            image: remainingImages[0],
            roomName: chapterTitle || chapterRoomName,
            imageIds: [remainingImages[0].id],
          });
        }
      }

      // Materials strip after chapter (if materials ledger exists)
      if (draft.materialsLedger?.items && draft.materialsLedger.items.length > 0) {
        // Extract products from chapter images
        const chapterProducts = chapterImages
          .flatMap(img => extractProducts(img))
          .filter((product, index, self) => 
            index === self.findIndex(p => p.id === product.id) // Deduplicate
          )
          .slice(0, 6); // Max 6 products

        if (chapterProducts.length > 0) {
          blocks.push({
            type: 'productInsert',
            products: chapterProducts,
            roomName: chapterTitle || chapterRoomName,
            isBoosted: false,
            imageIds: [],
          });
        }
      }

      // Insert pull quote from this chapter's own pullQuote field
      // Supports both legacy string format and new PullQuoteSelection object
      // Don't stack consecutive pull quotes; don't repeat the same quote text
      if (chapterIndex < draft.galleryChapters.length - 1) {
        const lastBlock = blocks[blocks.length - 1];
        const lastWasPullQuote = lastBlock?.type === 'pullQuote';

        if (!lastWasPullQuote) {
          const pqText = getSelectedPullQuoteText(chapter.pullQuote);
          const pqContext = getSelectedPullQuoteContext(chapter.pullQuote);
          // Legacy fallback: also check top-level pullQuotes for old data
          let chosenText = pqText;
          let chosenAttr = pqContext;

          if (!chosenText && draft.pullQuotes && draft.pullQuotes.length > 0) {
            const chapterName = (chapter.title || '').toLowerCase();
            const matchingQuote = draft.pullQuotes.find(raw => {
              const normalized = normalizePullQuote(raw);
              return normalized.sourceSection
                && normalized.sourceSection.toLowerCase() === chapterName
                && !usedPullQuoteTexts.has(normalized.text);
            });
            if (matchingQuote) {
              const n = normalizePullQuote(matchingQuote);
              chosenText = n.text;
              chosenAttr = n.context;
            }
          }

          if (chosenText && !usedPullQuoteTexts.has(chosenText)) {
            usedPullQuoteTexts.add(chosenText);
            blocks.push({
              type: 'pullQuote',
              text: chosenText,
              attribution: chosenAttr,
              imageIds: [],
            });
          }
        }
      }
    }
  } else {
    // Fallback: if no chapters, use image-based layout
    // This shouldn't happen for published posts, but handle gracefully
    const remainingImages = classified.slice(1); // Skip hero
    for (const image of remainingImages) {
      const roomName = getRoomName(image, roomMap);
      blocks.push({
        type: 'detail',
        image,
        roomName,
        imageIds: [image.id],
      });
    }
  }

  return blocks;
}

