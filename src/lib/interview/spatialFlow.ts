/**
 * Spatial Flow Extraction from Floor Plans
 *
 * Analyzes floor plan images using AI to understand room relationships
 * and spatial flow for generating interview questions about transitions.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SpatialRelationship, RoomContext } from './contextLevel';
import { MODELS } from '@/lib/ai/models';

const anthropic = new Anthropic();

export interface DetectedRoom {
  name: string;
  type: string;
  approximateSqft?: number;
}

export interface RoomConnection {
  from: string;
  to: string;
  type: 'opens_to' | 'flows_into' | 'connects' | 'grand_reveal' | 'intimate_transition';
  description?: string;
}

export interface FlowSequence {
  sequence: string[];
  narrative: string;
  keyMoments: Array<{
    from: string;
    to: string;
    type: 'grand_reveal' | 'intimate_transition' | 'flows_into' | 'opens_to';
    description?: string;
  }>;
}

export interface FloorPlanAnalysis {
  rooms: DetectedRoom[];
  connections: RoomConnection[];
  flow: FlowSequence[];
}

/**
 * Check if Anthropic API is enabled and available
 */
function isAnthropicEnabled(): boolean {
  return (
    process.env.ANTHROPIC_ENABLED === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

/**
 * Analyze a floor plan image to extract spatial relationships
 */
export async function analyzeFloorPlan(
  floorPlanUrl: string
): Promise<FloorPlanAnalysis> {
  if (!isAnthropicEnabled()) {
    console.warn('[spatialFlow] Anthropic API not enabled, returning empty analysis');
    return { rooms: [], connections: [], flow: [] };
  }

  try {
    // Fetch the image and convert to base64
    const imageResponse = await fetch(floorPlanUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch floor plan image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Determine media type from URL or response
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const mediaType = contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'image/jpeg'
      : contentType.includes('webp')
        ? 'image/webp'
        : contentType.includes('gif')
          ? 'image/gif'
          : 'image/png';

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analyze this floor plan and identify:

1. All rooms with their names/labels
2. How rooms connect to each other
3. The experiential flow through the space

Return JSON only (no markdown, no explanation):
{
  "rooms": [
    { "name": "Living Room", "type": "LIVING", "approximate_sqft": 400 }
  ],
  "connections": [
    { "from": "Entry", "to": "Living Room", "type": "opens_to", "description": "through the foyer" }
  ],
  "flow": [
    {
      "sequence": ["Entry", "Living Room", "Kitchen"],
      "narrative": "The entry opens to the living room which flows into the kitchen",
      "keyMoments": [
        { "from": "Living Room", "to": "Dining Room", "type": "grand_reveal", "description": "around the corner" }
      ]
    }
  ]
}

Connection types:
- "opens_to": Direct visual connection, no door
- "flows_into": Continuous space, gradual transition
- "connects": Door or threshold
- "grand_reveal": Dramatic reveal moment
- "intimate_transition": Shift to more private space

Focus on the experiential journey, not just the physical layout.
Return ONLY valid JSON, no other text.`,
            },
          ],
        },
      ],
    });

    // Parse the response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Try to extract JSON from the response (handle potential markdown wrapping)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      // Remove markdown code block
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const analysis = JSON.parse(jsonText) as FloorPlanAnalysis;

    // Normalize room types
    analysis.rooms = analysis.rooms.map((room) => ({
      ...room,
      type: normalizeRoomType(room.type),
    }));

    return analysis;
  } catch (error) {
    console.error('[spatialFlow] Failed to analyze floor plan:', error);
    return { rooms: [], connections: [], flow: [] };
  }
}

/**
 * Normalize room type strings to standard types
 */
function normalizeRoomType(type: string): string {
  const typeMap: Record<string, string> = {
    living: 'LIVING',
    'living room': 'LIVING',
    family: 'LIVING',
    'family room': 'LIVING',
    great: 'LIVING',
    'great room': 'LIVING',
    kitchen: 'KITCHEN',
    dining: 'DINING',
    'dining room': 'DINING',
    bedroom: 'BEDROOM',
    bed: 'BEDROOM',
    primary: 'PRIMARY_BEDROOM',
    master: 'PRIMARY_BEDROOM',
    'primary bedroom': 'PRIMARY_BEDROOM',
    'master bedroom': 'PRIMARY_BEDROOM',
    'primary suite': 'PRIMARY_BEDROOM',
    bath: 'BATH',
    bathroom: 'BATH',
    'powder room': 'BATH',
    office: 'OFFICE',
    study: 'OFFICE',
    den: 'OFFICE',
    entry: 'ENTRY',
    foyer: 'ENTRY',
    entryway: 'ENTRY',
    mudroom: 'ENTRY',
    outdoor: 'OUTDOOR',
    patio: 'OUTDOOR',
    deck: 'OUTDOOR',
    terrace: 'OUTDOOR',
    pool: 'OUTDOOR',
    garage: 'OTHER',
    laundry: 'OTHER',
    utility: 'OTHER',
    closet: 'OTHER',
    pantry: 'OTHER',
  };

  const normalized = type.toLowerCase().trim();
  return typeMap[normalized] || type.toUpperCase();
}

/**
 * Convert floor plan analysis to spatial relationships for context
 */
export function extractSpatialRelationships(
  analysis: FloorPlanAnalysis
): SpatialRelationship[] {
  const relationships: SpatialRelationship[] = [];

  // Extract from connections
  for (const connection of analysis.connections) {
    relationships.push({
      fromRoom: connection.from,
      toRoom: connection.to,
      relationship: connection.type as SpatialRelationship['relationship'],
      description: connection.description,
    });
  }

  // Add key moments from flow sequences
  for (const flow of analysis.flow) {
    for (const moment of flow.keyMoments) {
      // Avoid duplicates
      const exists = relationships.some(
        (r) =>
          r.fromRoom === moment.from &&
          r.toRoom === moment.to &&
          r.relationship === moment.type
      );

      if (!exists) {
        relationships.push({
          fromRoom: moment.from,
          toRoom: moment.to,
          relationship: moment.type,
          description: moment.description,
        });
      }
    }
  }

  return relationships;
}

/**
 * Build room adjacency data from floor plan analysis
 */
export function buildRoomAdjacencies(
  analysis: FloorPlanAnalysis,
  existingRooms: RoomContext[]
): RoomContext[] {
  // Create a map of room names to adjacent rooms
  const adjacencyMap = new Map<string, Set<string>>();

  for (const connection of analysis.connections) {
    // Add bidirectional adjacency
    if (!adjacencyMap.has(connection.from)) {
      adjacencyMap.set(connection.from, new Set());
    }
    if (!adjacencyMap.has(connection.to)) {
      adjacencyMap.set(connection.to, new Set());
    }

    adjacencyMap.get(connection.from)!.add(connection.to);
    adjacencyMap.get(connection.to)!.add(connection.from);
  }

  // Update existing rooms with adjacency data
  return existingRooms.map((room) => {
    const normalizedName = room.name.toLowerCase();

    // Try to match by name
    let adjacentRooms: string[] = [];
    for (const [name, adjacent] of adjacencyMap.entries()) {
      if (name.toLowerCase() === normalizedName || normalizedName.includes(name.toLowerCase())) {
        adjacentRooms = Array.from(adjacent);
        break;
      }
    }

    // Determine transition type from connections
    let transitionType: RoomContext['transitionType'];
    for (const connection of analysis.connections) {
      if (connection.from.toLowerCase() === normalizedName || connection.to.toLowerCase() === normalizedName) {
        if (connection.type === 'flows_into') {
          transitionType = 'flows_into';
        } else if (connection.type === 'opens_to') {
          transitionType = 'opens_to';
        } else if (connection.type === 'grand_reveal') {
          transitionType = 'reveals';
        } else if (connection.type === 'connects') {
          transitionType = 'connects';
        }
        break;
      }
    }

    return {
      ...room,
      adjacentRooms,
      transitionType,
    };
  });
}

/**
 * Generate a narrative description of the spatial flow
 */
export function generateFlowNarrative(analysis: FloorPlanAnalysis): string {
  if (analysis.flow.length === 0) {
    return '';
  }

  // Use the first flow sequence's narrative
  const primaryFlow = analysis.flow[0];
  return primaryFlow.narrative;
}
