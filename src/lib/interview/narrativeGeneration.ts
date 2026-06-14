/**
 * Editorial Narrative Generation
 *
 * Uses all available project context to generate transitional copy
 * for editorial content. Creates evocative descriptions of movement
 * through spaces and the overall design narrative.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ProjectContext, SpatialRelationship, RoomContext } from './contextLevel';
import { MODELS } from '@/lib/ai/models';

const anthropic = new Anthropic();

/**
 * Check if Anthropic API is enabled and available
 */
function isAnthropicEnabled(): boolean {
  return (
    process.env.ANTHROPIC_ENABLED === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

export interface NarrativeSegment {
  type: 'transition' | 'room_intro' | 'design_philosophy' | 'material_story';
  text: string;
  rooms?: string[];
  products?: string[];
}

/**
 * Generate spatial narrative sentences for transitions between rooms
 *
 * These are transitional sentences that describe movement through a space—
 * how one room leads to another, what reveals itself, how the experience unfolds.
 */
export async function generateSpatialNarrative(
  context: ProjectContext
): Promise<string[]> {
  if (context.level < 4) {
    // Need floor plan data for spatial narrative
    return [];
  }

  if (!isAnthropicEnabled()) {
    console.warn('[narrativeGeneration] Anthropic API not enabled, returning empty narrative');
    return [];
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1024,
      system: `You are writing transitional copy for an interior design editorial.
Your job is to describe movement through a space—how one room leads to another,
what reveals itself, how the experience unfolds.

Write in present tense. Be evocative but concise. Focus on the journey, not inventory.

Good: "The living room opens to reveal the kitchen beyond, where morning light pools on the marble island."
Bad: "The living room has a sofa and two chairs. The kitchen has marble countertops."

Return ONLY a JSON array of strings, no other text.`,
      messages: [
        {
          role: 'user',
          content: `Generate 3-4 transitional sentences for this project.

Spatial flow:
${JSON.stringify(context.spatialFlow, null, 2)}

Room details:
${JSON.stringify(
  context.rooms.map((r) => ({
    name: r.name,
    type: r.type,
    adjacentRooms: r.adjacentRooms,
    transitionType: r.transitionType,
  })),
  null,
  2
)}

Key pieces by room:
${context.rooms
  .filter((r) => r.keyPieces.length > 0)
  .map((r) => `${r.name}: ${r.keyPieces.map((p) => p.productName).join(', ')}`)
  .join('\n')}

Material themes: ${context.materialThemes.join(', ')}
Color palette: ${context.colorPalette.join(', ')}

Return as a JSON array of strings, each a standalone transitional sentence.
Example: ["The entry unfolds into...", "Beyond the kitchen..."]`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return [];
    }

    // Try to extract JSON from the response
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const sentences = JSON.parse(jsonText) as string[];
    return Array.isArray(sentences) ? sentences : [];
  } catch (error) {
    console.error('[narrativeGeneration] Failed to generate spatial narrative:', error);
    return [];
  }
}

/**
 * Generate a design narrative summary based on all available context
 *
 * This creates a cohesive paragraph that captures the essence of the project,
 * suitable for use as editorial introduction or overview.
 */
export async function generateDesignNarrative(
  context: ProjectContext
): Promise<string> {
  if (!isAnthropicEnabled()) {
    // Return a simple fallback based on available data
    return generateFallbackNarrative(context);
  }

  try {
    const contextDetails = buildContextDetails(context);

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 512,
      system: `You are writing a design narrative for an interior design publication.
Create a cohesive 2-3 sentence summary that captures the essence of the project.
Focus on the feeling, the materials, the light—not a room-by-room inventory.
Write in present tense. Be evocative but grounded in specifics.`,
      messages: [
        {
          role: 'user',
          content: `Write a design narrative for this project:

${contextDetails}

Return ONLY the narrative paragraph, no quotes or formatting.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return generateFallbackNarrative(context);
    }

    return content.text.trim();
  } catch (error) {
    console.error('[narrativeGeneration] Failed to generate design narrative:', error);
    return generateFallbackNarrative(context);
  }
}

/**
 * Build context details string for AI prompt
 */
function buildContextDetails(context: ProjectContext): string {
  const parts: string[] = [];

  if (context.projectTitle) {
    parts.push(`Project: ${context.projectTitle}`);
  }

  if (context.projectDescription) {
    parts.push(`Description: ${context.projectDescription}`);
  }

  if (context.rooms.length > 0) {
    const roomList = context.rooms.map((r) => r.name).join(', ');
    parts.push(`Rooms: ${roomList}`);
  }

  if (context.materialThemes.length > 0) {
    parts.push(`Material themes: ${context.materialThemes.join(', ')}`);
  }

  if (context.colorPalette.length > 0) {
    parts.push(`Color palette: ${context.colorPalette.join(', ')}`);
  }

  if (context.dominantVendors.length > 0) {
    const vendorList = context.dominantVendors
      .slice(0, 3)
      .map((v) => `${v.name} (${v.selectionCount} pieces)`)
      .join(', ');
    parts.push(`Key vendors: ${vendorList}`);
  }

  if (context.ambiencePatterns.length > 0) {
    const moods = context.ambiencePatterns.map((p) => p.description).join(', ');
    parts.push(`Mood: ${moods}`);
  }

  if (context.spatialFlow.length > 0) {
    const flows = context.spatialFlow
      .slice(0, 3)
      .map((f) => `${f.fromRoom} ${f.relationship.replace(/_/g, ' ')} ${f.toRoom}`)
      .join('; ');
    parts.push(`Spatial flow: ${flows}`);
  }

  return parts.join('\n');
}

/**
 * Generate a simple fallback narrative without AI
 */
function generateFallbackNarrative(context: ProjectContext): string {
  const parts: string[] = [];

  // Start with project title if available
  if (context.projectTitle) {
    parts.push(context.projectTitle);
  }

  // Add room count
  if (context.rooms.length > 0) {
    const roomTypes = context.rooms
      .map((r) => r.name)
      .filter((name, index, self) => self.indexOf(name) === index);

    if (roomTypes.length <= 3) {
      parts.push(`featuring ${roomTypes.join(', ')}`);
    } else {
      parts.push(`spanning ${roomTypes.length} distinct spaces`);
    }
  }

  // Add material themes
  if (context.materialThemes.length > 0) {
    const themeDescriptions: Record<string, string> = {
      natural_stone: 'natural stone',
      brass_hardware: 'brass accents',
      warm_wood: 'warm wood tones',
      luxe_textiles: 'luxurious textiles',
      modern_metal: 'modern metallics',
      industrial: 'industrial elements',
      modern_transparency: 'glass and transparency',
      natural_textiles: 'natural fibers',
    };

    const themes = context.materialThemes
      .slice(0, 2)
      .map((t) => themeDescriptions[t] || t)
      .join(' and ');

    if (themes) {
      parts.push(`with ${themes}`);
    }
  }

  // Add mood if available
  if (context.ambiencePatterns.length > 0) {
    const mood = context.ambiencePatterns[0].description.toLowerCase();
    parts.push(`creating a ${mood} atmosphere`);
  }

  if (parts.length === 0) {
    return '';
  }

  // Combine into a sentence
  const sentence = parts.join(' ') + '.';
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * Generate room introduction sentences
 *
 * Creates brief introductory sentences for each room that can be used
 * to transition into room-specific content.
 */
export async function generateRoomIntroductions(
  context: ProjectContext
): Promise<Map<string, string>> {
  const introductions = new Map<string, string>();

  if (!isAnthropicEnabled() || context.rooms.length === 0) {
    // Generate simple fallbacks
    for (const room of context.rooms) {
      introductions.set(room.name, generateRoomFallbackIntro(room, context));
    }
    return introductions;
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1024,
      system: `You are writing room introductions for an interior design editorial.
Each introduction should be one evocative sentence that sets up the room.
Focus on feeling and experience, not inventory.`,
      messages: [
        {
          role: 'user',
          content: `Generate one-sentence introductions for each room:

${context.rooms
  .map(
    (r) => `
Room: ${r.name}
Type: ${r.type || 'Unknown'}
Key pieces: ${r.keyPieces.map((p) => p.productName).join(', ') || 'None specified'}
Adjacent to: ${r.adjacentRooms.join(', ') || 'N/A'}
Transition: ${r.transitionType || 'N/A'}
`
  )
  .join('\n---\n')}

Return as JSON object with room names as keys and introduction sentences as values.
Example: {"Living Room": "Morning light cascades through...", "Kitchen": "At the heart of the home..."}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonText) as Record<string, string>;
      for (const [room, intro] of Object.entries(parsed)) {
        introductions.set(room, intro);
      }
    }
  } catch (error) {
    console.error('[narrativeGeneration] Failed to generate room introductions:', error);
    // Fall back to simple intros
    for (const room of context.rooms) {
      if (!introductions.has(room.name)) {
        introductions.set(room.name, generateRoomFallbackIntro(room, context));
      }
    }
  }

  return introductions;
}

/**
 * Generate a simple fallback room introduction without AI
 */
function generateRoomFallbackIntro(room: RoomContext, context: ProjectContext): string {
  const templates: Record<string, string[]> = {
    KITCHEN: [
      'The kitchen anchors the home with warmth and functionality.',
      'At the heart of the home, the kitchen invites gathering.',
    ],
    PRIMARY_BEDROOM: [
      'The primary suite offers a retreat from the day.',
      'A sanctuary of calm, the primary bedroom embraces rest.',
    ],
    LIVING: [
      'The living room sets the tone for the entire home.',
      'Light and life converge in the living space.',
    ],
    DINING: [
      'The dining room calls for lingering conversations.',
      'Gathering finds its place in the dining room.',
    ],
    BATH: [
      'The bathroom balances luxury with everyday livability.',
      'A spa-like quality pervades the bath.',
    ],
    ENTRY: [
      'The entry establishes the home\'s first impression.',
      'Arrival begins with intention in the entry.',
    ],
    OFFICE: [
      'The office creates a focused environment for work.',
      'Concentration finds its corner in the study.',
    ],
  };

  const roomType = room.type || 'OTHER';
  const typeTemplates = templates[roomType] || [
    `The ${room.name.toLowerCase()} contributes to the home's character.`,
  ];

  // Pick a random template
  return typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
}

/**
 * Generate material story segments
 *
 * Creates narrative segments about key materials used in the project.
 */
export async function generateMaterialStories(
  context: ProjectContext
): Promise<NarrativeSegment[]> {
  const segments: NarrativeSegment[] = [];

  if (context.materialThemes.length === 0) {
    return segments;
  }

  if (!isAnthropicEnabled()) {
    // Generate simple fallbacks for each theme
    for (const theme of context.materialThemes.slice(0, 2)) {
      segments.push({
        type: 'material_story',
        text: generateMaterialFallback(theme),
      });
    }
    return segments;
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1024,
      system: `You are writing about materials for an interior design publication.
Create evocative 1-2 sentence descriptions of how materials are used.
Focus on sensory experience and visual impact, not technical specs.`,
      messages: [
        {
          role: 'user',
          content: `Write material stories for these themes:

Themes: ${context.materialThemes.join(', ')}

Color palette context: ${context.colorPalette.join(', ')}
Room context: ${context.rooms.map((r) => r.name).join(', ')}

Return as JSON array:
[{"theme": "natural_stone", "text": "The marble..."}, ...]`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonText) as Array<{ theme: string; text: string }>;
      for (const item of parsed) {
        segments.push({
          type: 'material_story',
          text: item.text,
        });
      }
    }
  } catch (error) {
    console.error('[narrativeGeneration] Failed to generate material stories:', error);
    // Fall back to simple descriptions
    for (const theme of context.materialThemes.slice(0, 2)) {
      segments.push({
        type: 'material_story',
        text: generateMaterialFallback(theme),
      });
    }
  }

  return segments;
}

/**
 * Generate a simple fallback material description
 */
function generateMaterialFallback(theme: string): string {
  const fallbacks: Record<string, string> = {
    natural_stone: 'Natural stone brings timeless elegance, each vein telling its own story.',
    brass_hardware: 'Brass hardware threads through the space, warming each touch point.',
    warm_wood: 'Wood tones bring organic warmth, grounding the design in nature.',
    luxe_textiles: 'Luxurious textiles invite touch and add depth to every surface.',
    modern_metal: 'Sleek metal accents punctuate the space with contemporary edge.',
    industrial: 'Industrial elements add honest, architectural character.',
    modern_transparency: 'Glass and transparency create visual connections between spaces.',
    natural_textiles: 'Natural fibers bring texture and comfort to the soft goods.',
  };

  return fallbacks[theme] || `${theme.replace(/_/g, ' ')} contributes to the material story.`;
}
