/**
 * Generate Instagram caption from project data and AI article
 * Returns caption text and hashtags array
 */

import Anthropic from '@anthropic-ai/sdk';
import { Blocks } from '@/lib/posting/schemas';

interface CaptionInput {
  projectTitle: string;
  projectDescription?: string | null;
  city?: string | null;
  regionState?: string | null;
  projectType?: string | null;
  expandedBlocks?: Blocks | null;
  productTags?: Array<{ product: { name: string; category?: string | null; brand?: string | null } }>;
}

interface CaptionOutput {
  caption: string;
  hashtags: string[];
}

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic()
  : null;

export async function generateCaption(input: CaptionInput): Promise<CaptionOutput> {
  const {
    projectTitle,
    projectDescription,
    city,
    regionState,
    projectType,
    expandedBlocks,
    productTags = [],
  } = input;

  // Extract text content from expandedBlocks
  let articleText = '';
  if (expandedBlocks) {
    if (expandedBlocks.lead?.deck) {
      articleText += expandedBlocks.lead.deck + '\n\n';
    }
    if (expandedBlocks.galleryChapters) {
      for (const chapter of expandedBlocks.galleryChapters) {
        if (chapter.body && Array.isArray(chapter.body)) {
          articleText += chapter.body.join(' ') + '\n\n';
        }
      }
    }
  }

  // Fallback to description if no article text
  const sourceText = articleText.trim() || projectDescription || '';

  // Generate hashtags from products, location, project type
  const hashtags: string[] = [];
  
  // Location hashtags
  if (city) {
    const cityTag = city.toLowerCase().replace(/\s+/g, '');
    hashtags.push(`#${cityTag}design`, `#${cityTag}interiors`);
  }
  if (regionState) {
    const stateTag = regionState.toLowerCase().replace(/\s+/g, '');
    hashtags.push(`#${stateTag}design`);
  }

  // Project type hashtags
  if (projectType) {
    const typeMap: Record<string, string[]> = {
      RESIDENTIAL: ['#residentialdesign', '#homedesign', '#interiordesign'],
      COMMERCIAL: ['#commercialdesign', '#officedesign'],
      HOSPITALITY: ['#hospitalitydesign', '#hoteldesign'],
      RETAIL: ['#retaildesign', '#storedesign'],
    };
    hashtags.push(...(typeMap[projectType] || []));
  }

  // Product/brand hashtags (limit to top 5)
  const productHashtags = productTags
    .slice(0, 5)
    .map(tag => {
      const brand = tag.product.brand?.toLowerCase().replace(/\s+/g, '');
      const category = tag.product.category?.toLowerCase().replace(/\s+/g, '');
      return [brand ? `#${brand}` : null, category ? `#${category}` : null].filter(Boolean);
    })
    .flat()
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx) as string[];
  
  hashtags.push(...productHashtags);

  // Standard design hashtags
  hashtags.push('#interiordesign', '#homedesign', '#design', '#foliodesign');

  // Limit to 20 hashtags total
  const finalHashtags = hashtags.slice(0, 20);

  // Generate caption using Anthropic if available
  if (anthropic && sourceText) {
    try {
      const prompt = `Write a concise, elegant Instagram caption (max 2000 characters) for a design project.

Project: ${projectTitle}
${city ? `Location: ${city}${regionState ? `, ${regionState}` : ''}` : ''}
${projectType ? `Type: ${projectType}` : ''}

${sourceText ? `Article excerpt:\n${sourceText.substring(0, 1000)}` : ''}

Requirements:
- Tone: Quiet elegance, editorial, refined
- Include a brief description (2-3 sentences)
- End with ONE of these CTAs (choose the one that reads more naturally):
  Option A: "You can now shop every product and read the full feature on Folio → link in bio"
  Option B: "The complete story, shoppable product details, and behind-the-scenes are now live on Folio → link in bio"
- Do NOT include hashtags in the caption (they'll be added separately on a new line)
- Keep it under 2000 characters`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        system: 'You are a copywriter for Folio, a premium interior design platform. Write elegant, concise captions that match the brand\'s quiet sophistication.',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      let generatedCaption = (message.content[0]?.type === 'text' ? message.content[0].text : '').trim();
      
      // Ensure caption ends with proper CTA if not already present
      if (generatedCaption && !generatedCaption.includes('link in bio') && !generatedCaption.includes('Folio')) {
        // Add CTA if missing
        generatedCaption += '\n\nThe complete story, shoppable product details, and behind-the-scenes are now live on Folio → link in bio';
      }
      
      // Fallback if generation fails
      if (generatedCaption && generatedCaption.length > 50) {
        return {
          caption: generatedCaption,
          hashtags: finalHashtags,
        };
      }
    } catch (error) {
      console.warn('[generateCaption] Anthropic error, using fallback:', error);
    }
  }

  // Fallback caption generation
  const locationStr = city ? (regionState ? `${city}, ${regionState}` : city) : '';
  const description = sourceText.substring(0, 300) || projectDescription?.substring(0, 300) || '';
  
  let caption = `${projectTitle}`;
  if (locationStr) {
    caption += `\n\nA ${projectType?.toLowerCase() || 'design'} project in ${locationStr}.`;
  }
  if (description) {
    caption += `\n\n${description}`;
  }
  
  // Use Option B for fallback (more editorial)
  caption += `\n\nThe complete story, shoppable product details, and behind-the-scenes are now live on Folio → link in bio`;

  return {
    caption: caption.trim(),
    hashtags: finalHashtags,
  };
}

