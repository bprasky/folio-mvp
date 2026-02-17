/**
 * Contextual Interview Question Generation
 *
 * Generates interview questions that scale with available project context.
 * Each level unlocks new question types while maintaining all previous levels.
 *
 * The rule: Every question sets up an answer the designer would be proud to publish
 * and a vendor would want to boost. We ask about arrivals, not departures. Wins, not compromises.
 */

import { randomUUID } from 'crypto';
import type {
  ProjectContext,
  RoomContext,
  SelectionContext,
  VendorInsight,
  SpatialRelationship,
  DecisionEvent,
  ContextLevel,
} from './contextLevel';
import { buildInterviewBrief, type AIGeneratedQuestion, type InterviewBrief } from './buildInterviewBrief';

// Question types that can be generated
export type QuestionType =
  | 'generic'
  | 'room_specific'
  | 'aesthetic'
  | 'vendor_loyalty'
  | 'hero_piece'
  | 'material_theme'
  | 'vision_realization'
  | 'vision_achieved'
  | 'aesthetic_continuity'
  | 'spatial_narrative'
  | 'spatial_flow'
  | 'sightlines'
  | 'decision_journey'
  | 'promoted_win'
  | 'conviction_piece'
  | 'prospective_vision';

export interface GeneratedQuestion {
  id: string;
  text: string;
  contextLevel: ContextLevel;
  type: QuestionType;

  // Associations for tagging/boosting
  rooms?: string[];
  products?: string[];
  vendors?: string[];

  // Boost eligibility
  boostable: boolean;

  // For editorial pull quote potential
  pullQuotePotential: 'high' | 'medium' | 'low';

  // Helper text (optional)
  helper?: string;

  /** Semantic topic for dedup — questions sharing a topic compete, most specific wins */
  topic?: string;

  // Original question metadata (for compatibility with existing system)
  linkedImageId?: string;
  linkedProductId?: string;
  attributeType?: 'color' | 'material' | 'style' | 'mood' | 'element';
  attributeValue?: string;
  roomContext?: string;
}

/**
 * Semantic topics for question deduplication.
 * Questions sharing a topic compete — the most specific version wins.
 */
const TOPICS = {
  PROJECT_STORY: 'project_story',
  PROJECT_VISION: 'project_vision',
  OVERALL_AESTHETIC: 'overall_aesthetic',
  EMOTIONAL_IMPACT: 'emotional_impact',
  ANCHOR_PIECE: 'anchor_piece',
  MATERIAL_THREAD: 'material_thread',
  VENDOR_LOYALTY: 'vendor_loyalty',
  ROOM_STORY: 'room_story',
  DESIGN_EVOLUTION: 'design_evolution',
  FAVORITE_MOMENT: 'favorite_moment',
  CLIENT_INFLUENCE: 'client_influence',
  CHALLENGES: 'challenges',
  SELECTION_JOURNEY: 'selection_journey',
  ROOM_RELATIONSHIPS: 'room_relationships',
  DECISION_JOURNEY: 'decision_journey',
} as const;

// Level 0: Generic fallback questions (current state)
const LEVEL_0_QUESTIONS = {
  layer1: [
    {
      text: 'Tell us about this project and what made it special.',
      helper: 'Share what drew you to this project or made it meaningful.',
      topic: TOPICS.PROJECT_STORY,
    },
    {
      text: 'What was the initial vision for this space?',
      helper: 'Describe the concept or direction from the beginning.',
      topic: TOPICS.PROJECT_VISION,
    },
    {
      text: 'How would you describe the overall aesthetic?',
      helper: 'Think about the feeling, style, and mood of the space.',
      topic: TOPICS.OVERALL_AESTHETIC,
    },
    {
      text: 'What was your favorite part of this project?',
      helper: 'Share a moment, detail, or outcome that stands out.',
      topic: TOPICS.FAVORITE_MOMENT,
    },
  ],
  layer2: [
    {
      text: 'Who is this home for and how did that influence your decisions?',
      helper: 'Consider how the client shaped the design direction.',
      topic: TOPICS.CLIENT_INFLUENCE,
    },
    {
      text: 'What challenges did you navigate during this project?',
      helper: 'Focus on how you solved problems creatively.',
      topic: TOPICS.CHALLENGES,
    },
    {
      text: 'Is there a piece in this project that anchors the whole design?',
      helper: 'Think about a signature element that ties everything together.',
      topic: TOPICS.ANCHOR_PIECE,
    },
    {
      text: 'What do you hope people feel when they walk into this space?',
      helper: 'Describe the emotional impact you were aiming for.',
      topic: TOPICS.EMOTIONAL_IMPACT,
    },
  ],
};

// Prospective project questions — for projects in the planning/design phase.
// Tone: invite the designer to share the evolving story naturally.
// Never ask about budget, alternatives, or anything that sounds judgmental when published.
const PROSPECTIVE_QUESTIONS = {
  layer1: [
    {
      text: 'Tell us about the vision for this project and what inspired it.',
      helper: 'Share what drew you to this direction — the story behind the concept.',
      topic: TOPICS.PROJECT_VISION,
    },
    {
      text: 'How do you envision the finished space feeling when it all comes together?',
      helper: 'Describe the mood, the atmosphere, the experience you\'re designing toward.',
      topic: TOPICS.EMOTIONAL_IMPACT,
    },
    {
      text: 'Walk us through how you arrived at these selections.',
      helper: 'Share the story of what drew you to these particular pieces.',
      topic: TOPICS.SELECTION_JOURNEY,
    },
    {
      text: 'Has the project evolved from the original vision at all?',
      helper: 'Let the story of the design journey unfold naturally.',
      topic: TOPICS.DESIGN_EVOLUTION,
    },
  ],
  // layer2 templates are generated dynamically in generateProspectiveQuestions()
  // to inject room names and material data instead of staying generic
};

/**
 * Generate prospective project questions (planning/design phase).
 * These replace generic questions when the project has generated images.
 */
function generateProspectiveQuestions(context: ProjectContext): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];
  const roomCount = context.rooms.length;

  for (const q of PROSPECTIVE_QUESTIONS.layer1) {
    questions.push({
      id: `prospective-${randomUUID()}`,
      text: q.text,
      helper: q.helper,
      topic: q.topic,
      contextLevel: 1,
      type: 'prospective_vision',
      boostable: false,
      pullQuotePotential: 'medium',
    });
  }

  // Layer 2: Dynamic prospective questions using project data
  // Anchor piece — use hero piece name if available
  const heroPiece = context.selections.find((s) => s.isHeroPiece);
  if (heroPiece) {
    questions.push({
      id: `prospective-${randomUUID()}`,
      text: `The ${heroPiece.productName}${heroPiece.brand ? ` from ${heroPiece.brand}` : ''} feels like it could anchor the ${heroPiece.room} — is that the piece the rest of the design revolves around?`,
      topic: TOPICS.ANCHOR_PIECE,
      contextLevel: 1,
      type: 'prospective_vision',
      rooms: [heroPiece.room],
      products: [heroPiece.productName],
      vendors: heroPiece.brand ? [heroPiece.brand] : [],
      boostable: !!heroPiece.brand,
      pullQuotePotential: 'high',
    });
  } else {
    questions.push({
      id: `prospective-${randomUUID()}`,
      text: 'What\'s the anchor piece that the rest of the design revolves around?',
      topic: TOPICS.ANCHOR_PIECE,
      contextLevel: 1,
      type: 'prospective_vision',
      boostable: false,
      pullQuotePotential: 'high',
    });
  }

  // Room relationships — only for multi-room, use actual room names
  if (roomCount >= 2) {
    const roomNames = context.rooms.slice(0, 3).map((r) => r.name);
    questions.push({
      id: `prospective-${randomUUID()}`,
      text: `How are you thinking about the flow between the ${roomNames.join(' and the ')}? Is there a material or palette that carries across?`,
      topic: TOPICS.ROOM_RELATIONSHIPS,
      contextLevel: 1,
      type: 'prospective_vision',
      rooms: roomNames,
      boostable: false,
      pullQuotePotential: 'high',
    });
  }

  // Material thread — use actual materials if available
  if (context.materialThemes.length > 0) {
    const materialName = context.materialThemes[0].replace(/_/g, ' ');
    questions.push({
      id: `prospective-${randomUUID()}`,
      text: `There's a clear ${materialName} thread running through the project. Is that intentional, or did it emerge as you went?`,
      topic: TOPICS.MATERIAL_THREAD,
      contextLevel: 1,
      type: 'prospective_vision',
      boostable: false,
      pullQuotePotential: 'high',
    });
  } else {
    questions.push({
      id: `prospective-${randomUUID()}`,
      text: 'Is there a material or finish that became the thread tying this project together?',
      topic: TOPICS.MATERIAL_THREAD,
      contextLevel: 1,
      type: 'prospective_vision',
      boostable: false,
      pullQuotePotential: 'high',
    });
  }

  // Room-specific prospective questions
  for (const room of context.rooms) {
    if (room.selectionCount > 0) {
      questions.push({
        id: `prospective-room-${room.id}`,
        text: `Tell us the story behind the ${room.name}. What are you building toward in this space?`,
        topic: TOPICS.ROOM_STORY,
        contextLevel: 1,
        type: 'prospective_vision',
        rooms: [room.name],
        boostable: false,
        pullQuotePotential: 'high',
        roomContext: room.name,
      });
    }
  }

  // Vendor-specific prospective questions
  for (const vendor of context.dominantVendors) {
    if (vendor.selectionCount >= 2) {
      questions.push({
        id: `prospective-vendor-${vendor.name.replace(/\s+/g, '-').toLowerCase()}`,
        text: `You've chosen ${vendor.name} for several pieces. What draws you to their work?`,
        topic: TOPICS.VENDOR_LOYALTY,
        contextLevel: 1,
        type: 'prospective_vision',
        vendors: [vendor.name],
        rooms: vendor.rooms,
        boostable: true,
        pullQuotePotential: 'high',
      });
    }
  }

  // Product-specific prospective questions — hero pieces anchor the design story.
  // For prospective projects with selections, surface individual products without
  // requiring a material_schedule file (which gates Level 2).
  const heroPieces = context.selections.filter((s) => s.isHeroPiece);
  for (const selection of heroPieces.slice(0, 3)) {
    questions.push({
      id: `prospective-hero-${selection.id}`,
      text: `The ${selection.productName} is a statement piece for the ${selection.room}. What drew you to it?`,
      topic: TOPICS.ANCHOR_PIECE,
      contextLevel: 1,
      type: 'hero_piece',
      products: [selection.id],
      vendors: [selection.brand],
      rooms: [selection.room],
      boostable: true,
      pullQuotePotential: 'high',
      linkedProductId: selection.id,
      roomContext: selection.room,
    });
  }

  return questions;
}

/**
 * Generate Level 0 generic questions
 */
function generateLevel0Questions(): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];

  for (const q of LEVEL_0_QUESTIONS.layer1) {
    questions.push({
      id: `l0-${randomUUID()}`,
      text: q.text,
      helper: q.helper,
      topic: q.topic,
      contextLevel: 0,
      type: 'generic',
      boostable: false,
      pullQuotePotential: 'low',
    });
  }

  for (const q of LEVEL_0_QUESTIONS.layer2) {
    questions.push({
      id: `l0-${randomUUID()}`,
      text: q.text,
      helper: q.helper,
      topic: q.topic,
      contextLevel: 0,
      type: 'generic',
      boostable: false,
      pullQuotePotential: 'medium',
    });
  }

  return questions;
}

/**
 * Generate Level 1 questions (photos available)
 * Room-based, visual observations
 */
function generateLevel1Questions(context: ProjectContext): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];

  // Room-specific observations
  for (const room of context.rooms) {
    const roomType = room.type;

    if (roomType === 'KITCHEN') {
      questions.push({
        id: `l1-kitchen-${room.id}`,
        text: `The kitchen feels like the heart of this home. What was your approach to making it both functional and beautiful?`,
        topic: TOPICS.ROOM_STORY,
        contextLevel: 1,
        type: 'room_specific',
        rooms: [room.name],
        boostable: false,
        pullQuotePotential: 'medium',
        roomContext: room.name,
      });
    }

    if (roomType === 'PRIMARY_BEDROOM') {
      questions.push({
        id: `l1-primary-${room.id}`,
        text: `Walk us through creating a primary suite that feels like a retreat.`,
        topic: TOPICS.ROOM_STORY,
        contextLevel: 1,
        type: 'room_specific',
        rooms: [room.name],
        boostable: false,
        pullQuotePotential: 'medium',
        roomContext: room.name,
      });
    }

    if (roomType === 'BATH') {
      questions.push({
        id: `l1-bath-${room.id}`,
        text: `The bathroom has a spa-like quality. How did you balance luxury with everyday livability?`,
        topic: TOPICS.ROOM_STORY,
        contextLevel: 1,
        type: 'room_specific',
        rooms: [room.name],
        boostable: false,
        pullQuotePotential: 'medium',
        roomContext: room.name,
      });
    }

    if (roomType === 'LIVING') {
      questions.push({
        id: `l1-living-${room.id}`,
        text: `The living room sets the tone for the whole house. What drove the key decisions here?`,
        topic: TOPICS.ROOM_STORY,
        contextLevel: 1,
        type: 'room_specific',
        rooms: [room.name],
        boostable: false,
        pullQuotePotential: 'medium',
        roomContext: room.name,
      });
    }

    if (roomType === 'DINING') {
      questions.push({
        id: `l1-dining-${room.id}`,
        text: `Tell us about creating a dining space that invites people to linger.`,
        topic: TOPICS.ROOM_STORY,
        contextLevel: 1,
        type: 'room_specific',
        rooms: [room.name],
        boostable: false,
        pullQuotePotential: 'medium',
        roomContext: room.name,
      });
    }

    if (roomType === 'ENTRY') {
      questions.push({
        id: `l1-entry-${room.id}`,
        text: `The entry makes a strong first impression. How did you design that arrival moment?`,
        topic: TOPICS.ROOM_STORY,
        contextLevel: 1,
        type: 'room_specific',
        rooms: [room.name],
        boostable: false,
        pullQuotePotential: 'high',
        roomContext: room.name,
      });
    }
  }

  // Color/material observations from photos
  if (context.colorPalette.includes('warm_neutrals')) {
    questions.push({
      id: `l1-warmth-${randomUUID()}`,
      text: `There's a beautiful warmth throughout this project. Tell us about developing that palette.`,
      topic: TOPICS.OVERALL_AESTHETIC,
      contextLevel: 1,
      type: 'aesthetic',
      boostable: false,
      pullQuotePotential: 'medium',
    });
  }

  if (context.colorPalette.includes('light_and_airy')) {
    questions.push({
      id: `l1-airy-${randomUUID()}`,
      text: `The space feels light and airy. How did you achieve that sense of openness?`,
      topic: TOPICS.OVERALL_AESTHETIC,
      contextLevel: 1,
      type: 'aesthetic',
      boostable: false,
      pullQuotePotential: 'medium',
    });
  }

  if (context.colorPalette.includes('dark_dramatic')) {
    questions.push({
      id: `l1-dramatic-${randomUUID()}`,
      text: `You've embraced a dramatic, moody palette. What led you in that direction?`,
      topic: TOPICS.OVERALL_AESTHETIC,
      contextLevel: 1,
      type: 'aesthetic',
      boostable: false,
      pullQuotePotential: 'high',
    });
  }

  return questions;
}

/**
 * Generate Level 2 questions (material schedule available)
 * Product-specific, vendor loyalty
 */
function generateLevel2Questions(context: ProjectContext): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];

  // Vendor loyalty questions
  for (const vendor of context.dominantVendors) {
    if (vendor.selectionCount >= 3) {
      const roomList = vendor.rooms.slice(0, 3).join(', ');
      questions.push({
        id: `l2-vendor-${vendor.name.replace(/\s+/g, '-').toLowerCase()}`,
        text: `${vendor.name} appears throughout this project${roomList ? `—in the ${roomList}` : ''}. What keeps you coming back to them?`,
        topic: TOPICS.VENDOR_LOYALTY,
        contextLevel: 2,
        type: 'vendor_loyalty',
        vendors: [vendor.name],
        rooms: vendor.rooms,
        boostable: true,
        pullQuotePotential: 'high',
      });
    }
  }

  // Hero piece questions
  const heroPieces = context.selections.filter((s) => s.isHeroPiece);
  for (const selection of heroPieces.slice(0, 3)) {
    questions.push({
      id: `l2-hero-${selection.id}`,
      text: `The ${selection.productName} in the ${selection.room} really anchors the space. Tell us about selecting this piece.`,
      topic: TOPICS.ANCHOR_PIECE,
      contextLevel: 2,
      type: 'hero_piece',
      products: [selection.id],
      vendors: [selection.brand],
      rooms: [selection.room],
      boostable: true,
      pullQuotePotential: 'high',
      linkedProductId: selection.id,
      roomContext: selection.room,
    });
  }

  // Material theme questions
  if (context.materialThemes.includes('natural_stone')) {
    questions.push({
      id: `l2-stone-${randomUUID()}`,
      text: `Natural stone plays a significant role here. Walk us through how you approached the stone selections.`,
      topic: TOPICS.MATERIAL_THREAD,
      contextLevel: 2,
      type: 'material_theme',
      boostable: false,
      pullQuotePotential: 'medium',
      attributeType: 'material',
      attributeValue: 'natural stone',
    });
  }

  if (context.materialThemes.includes('brass_hardware')) {
    questions.push({
      id: `l2-brass-${randomUUID()}`,
      text: `The brass hardware creates continuity throughout. Was that an early decision or did it emerge?`,
      topic: TOPICS.MATERIAL_THREAD,
      contextLevel: 2,
      type: 'material_theme',
      boostable: false,
      pullQuotePotential: 'medium',
      attributeType: 'material',
      attributeValue: 'brass',
    });
  }

  if (context.materialThemes.includes('warm_wood')) {
    questions.push({
      id: `l2-wood-${randomUUID()}`,
      text: `Wood brings such warmth to this project. Tell us about selecting the species and finishes.`,
      topic: TOPICS.MATERIAL_THREAD,
      contextLevel: 2,
      type: 'material_theme',
      boostable: false,
      pullQuotePotential: 'medium',
      attributeType: 'material',
      attributeValue: 'wood',
    });
  }

  if (context.materialThemes.includes('luxe_textiles')) {
    questions.push({
      id: `l2-textiles-${randomUUID()}`,
      text: `The textiles feel luxurious and considered. How did you approach the soft goods?`,
      topic: TOPICS.MATERIAL_THREAD,
      contextLevel: 2,
      type: 'material_theme',
      boostable: false,
      pullQuotePotential: 'medium',
      attributeType: 'material',
      attributeValue: 'textiles',
    });
  }

  return questions;
}

/**
 * Generate Level 3 questions (concept presentation available)
 * Vision realization, aesthetic choices
 */
function generateLevel3Questions(context: ProjectContext): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];

  // Vision realization
  questions.push({
    id: `l3-vision-${randomUUID()}`,
    text: `Looking at where this project started and where it landed, what are you most proud of achieving?`,
    topic: TOPICS.FAVORITE_MOMENT,
    contextLevel: 3,
    type: 'vision_realization',
    boostable: false,
    pullQuotePotential: 'high',
  });

  // Aspirational items that made it (if we have data)
  for (const item of context.aspirationalItems.slice(0, 2)) {
    const matchingSelection = context.selections.find(
      (s) =>
        s.productName.toLowerCase().includes(item.productName.toLowerCase()) ||
        s.brand.toLowerCase().includes(item.brand.toLowerCase())
    );

    if (matchingSelection) {
      questions.push({
        id: `l3-aspirational-${matchingSelection.id}`,
        text: `The ${matchingSelection.productName} was part of your original vision and made it to the final design. What made this one worth prioritizing?`,
        topic: TOPICS.ANCHOR_PIECE,
        contextLevel: 3,
        type: 'vision_achieved',
        products: [matchingSelection.id],
        vendors: [matchingSelection.brand],
        boostable: true,
        pullQuotePotential: 'high',
        linkedProductId: matchingSelection.id,
      });
    }
  }

  // Ambience patterns that shaped the outcome
  if (context.ambiencePatterns.length > 0) {
    const dominantMood = context.ambiencePatterns[0];
    questions.push({
      id: `l3-ambience-${randomUUID()}`,
      text: `There's a ${dominantMood.description} quality throughout this project. How did you maintain that thread from concept to completion?`,
      topic: TOPICS.OVERALL_AESTHETIC,
      contextLevel: 3,
      type: 'aesthetic_continuity',
      boostable: false,
      pullQuotePotential: 'medium',
      attributeType: 'mood',
      attributeValue: dominantMood.description,
    });
  }

  // Add general vision questions
  questions.push({
    id: `l3-concept-evolution-${randomUUID()}`,
    text: `How did the concept evolve from your initial presentation to the finished space?`,
    topic: TOPICS.DESIGN_EVOLUTION,
    contextLevel: 3,
    type: 'vision_realization',
    boostable: false,
    pullQuotePotential: 'medium',
  });

  return questions;
}

/**
 * Generate Level 4 questions (floor plan available)
 * Spatial flow, transitions, reveals
 */
function generateLevel4Questions(context: ProjectContext): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];

  // Spatial flow questions from analyzed floor plan
  for (const flow of context.spatialFlow) {
    if (flow.relationship === 'grand_reveal') {
      questions.push({
        id: `l4-reveal-${flow.fromRoom}-${flow.toRoom}`,
        text: `The ${flow.fromRoom} leads ${flow.description || 'around'} to the ${flow.toRoom} in what feels like a reveal moment. Was that drama intentional?`,
        topic: TOPICS.ROOM_RELATIONSHIPS,
        contextLevel: 4,
        type: 'spatial_narrative',
        rooms: [flow.fromRoom, flow.toRoom],
        boostable: false,
        pullQuotePotential: 'high',
      });
    }

    if (flow.relationship === 'flows_into') {
      questions.push({
        id: `l4-flow-${flow.fromRoom}-${flow.toRoom}`,
        text: `There's a beautiful continuity as the ${flow.fromRoom} flows into the ${flow.toRoom}. How did you think about that transition?`,
        topic: TOPICS.ROOM_RELATIONSHIPS,
        contextLevel: 4,
        type: 'spatial_flow',
        rooms: [flow.fromRoom, flow.toRoom],
        boostable: false,
        pullQuotePotential: 'high',
      });
    }

    if (flow.relationship === 'intimate_transition') {
      questions.push({
        id: `l4-intimate-${flow.fromRoom}-${flow.toRoom}`,
        text: `The shift from the ${flow.fromRoom} to the ${flow.toRoom} feels like moving into a more private world. Talk to us about creating that sense of retreat.`,
        topic: TOPICS.ROOM_RELATIONSHIPS,
        contextLevel: 4,
        type: 'spatial_narrative',
        rooms: [flow.fromRoom, flow.toRoom],
        boostable: false,
        pullQuotePotential: 'high',
      });
    }
  }

  // Sightline questions for open plan rooms
  const openPlanRooms = context.rooms.filter((r) => r.adjacentRooms.length >= 2);
  for (const room of openPlanRooms) {
    questions.push({
      id: `l4-sightlines-${room.id}`,
      text: `From the ${room.name}, you can see into the ${room.adjacentRooms.join(' and ')}. How did you approach materials and palette to make that work?`,
      topic: TOPICS.ROOM_RELATIONSHIPS,
      contextLevel: 4,
      type: 'sightlines',
      rooms: [room.name, ...room.adjacentRooms],
      boostable: false,
      pullQuotePotential: 'high',
    });
  }

  // General spatial questions if no specific flow data
  if (context.spatialFlow.length === 0 && context.rooms.length >= 2) {
    questions.push({
      id: `l4-journey-${randomUUID()}`,
      text: `Walk us through the journey through this space. How did you think about the sequence of rooms and experiences?`,
      topic: TOPICS.ROOM_RELATIONSHIPS,
      contextLevel: 4,
      type: 'spatial_flow',
      boostable: false,
      pullQuotePotential: 'high',
    });

    questions.push({
      id: `l4-transitions-${randomUUID()}`,
      text: `How did you create continuity between spaces while giving each room its own character?`,
      topic: TOPICS.ROOM_RELATIONSHIPS,
      contextLevel: 4,
      type: 'spatial_flow',
      boostable: false,
      pullQuotePotential: 'medium',
    });
  }

  return questions;
}

/**
 * Generate Level 5 questions (progress presentations available)
 * Decision journey, "landing on" narratives
 */
function generateLevel5Questions(context: ProjectContext): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];

  // Evolution questions (never mention what was replaced)
  for (const decision of context.decisionTrail) {
    if (decision.event === 'evolved' && decision.iterationCount && decision.iterationCount >= 2) {
      questions.push({
        id: `l5-evolved-${decision.productId || randomUUID()}`,
        text: `The ${decision.productName} in the ${decision.room} went through a few rounds before you landed on it. Walk us through what made this the right choice.`,
        topic: TOPICS.DECISION_JOURNEY,
        contextLevel: 5,
        type: 'decision_journey',
        products: decision.productId ? [decision.productId] : undefined,
        vendors: [decision.brand],
        rooms: [decision.room],
        boostable: true,
        pullQuotePotential: 'high',
        linkedProductId: decision.productId,
        roomContext: decision.room,
      });
    }

    if (decision.event === 'promoted') {
      questions.push({
        id: `l5-promoted-${decision.productId || randomUUID()}`,
        text: `The ${decision.productName} started as an aspiration and made it to the final specification. What was the moment you knew it had to be in this project?`,
        topic: TOPICS.DECISION_JOURNEY,
        contextLevel: 5,
        type: 'promoted_win',
        products: decision.productId ? [decision.productId] : undefined,
        vendors: [decision.brand],
        boostable: true,
        pullQuotePotential: 'high',
        linkedProductId: decision.productId,
      });
    }
  }

  // "Fought for" questions
  const foughtFor = context.selections.filter((s) => s.decisionJourney === 'fought_for');
  for (const selection of foughtFor.slice(0, 2)) {
    questions.push({
      id: `l5-foughtfor-${selection.id}`,
      text: `Tell us about the ${selection.productName}. It feels like a piece that required some conviction to get into the project.`,
      topic: TOPICS.ANCHOR_PIECE,
      contextLevel: 5,
      type: 'conviction_piece',
      products: [selection.id],
      vendors: [selection.brand],
      boostable: true,
      pullQuotePotential: 'high',
      linkedProductId: selection.id,
    });
  }

  // General decision journey questions if no specific trail data
  if (context.decisionTrail.length === 0) {
    questions.push({
      id: `l5-landing-${randomUUID()}`,
      text: `Tell us about a selection that took several rounds to land on. What made you finally commit?`,
      topic: TOPICS.DECISION_JOURNEY,
      contextLevel: 5,
      type: 'decision_journey',
      boostable: false,
      pullQuotePotential: 'high',
    });

    questions.push({
      id: `l5-conviction-${randomUUID()}`,
      text: `Was there a piece you had to fight for—one that required conviction to get into the project?`,
      topic: TOPICS.ANCHOR_PIECE,
      contextLevel: 5,
      type: 'conviction_piece',
      boostable: false,
      pullQuotePotential: 'high',
    });
  }

  return questions;
}

interface PrioritizationOptions {
  preferHigherContext?: boolean;
  preferBoostable?: boolean;
  preferPullQuotePotential?: boolean;
}

/**
 * Prioritize questions based on options
 */
function prioritizeQuestions(
  questions: GeneratedQuestion[],
  options: PrioritizationOptions
): GeneratedQuestion[] {
  return [...questions].sort((a, b) => {
    // Higher context level = better question
    if (options.preferHigherContext) {
      if (a.contextLevel !== b.contextLevel) {
        return b.contextLevel - a.contextLevel;
      }
    }

    // Boostable questions have revenue potential
    if (options.preferBoostable) {
      if (a.boostable !== b.boostable) {
        return a.boostable ? -1 : 1;
      }
    }

    // Pull quote potential for editorial
    if (options.preferPullQuotePotential) {
      const potentialRank = { high: 3, medium: 2, low: 1 };
      const diff = potentialRank[b.pullQuotePotential] - potentialRank[a.pullQuotePotential];
      if (diff !== 0) return diff;
    }

    return 0;
  });
}

/**
 * Score a question's specificity. Higher = more grounded in project data.
 * Used to determine which question wins within a topic group.
 */
function specificityScore(q: GeneratedQuestion): number {
  let score = 0;
  if (q.linkedProductId || q.products?.length) score += 4;
  if (q.rooms?.length) score += 2;
  if (q.vendors?.length) score += 1;
  if (q.boostable) score += 1;
  score += q.contextLevel;
  const pqRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  score += pqRank[q.pullQuotePotential] || 0;
  return score;
}

/**
 * Produce a qualifier that distinguishes questions within the same topic.
 * 'generic' means the question has no specific product/vendor/room grounding.
 */
function topicQualifier(q: GeneratedQuestion): string {
  if (q.linkedProductId) return `product:${q.linkedProductId}`;
  if (q.products?.length) return `product:${q.products[0]}`;
  if (q.vendors?.length) return `vendor:${q.vendors.slice().sort().join('+')}`;
  if (q.rooms?.length) return `room:${q.rooms.slice().sort().join('+')}`;
  return 'generic';
}

/**
 * Remove semantically overlapping questions using topic tags.
 * Within each topic group, keeps only the most specific version(s).
 * Questions without topics still go through legacy text-based dedup.
 */
function deduplicateSimilar(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  // Phase 1: Topic-based semantic dedup
  const topicGroups = new Map<string, GeneratedQuestion[]>();
  const noTopic: GeneratedQuestion[] = [];

  for (const q of questions) {
    if (q.topic) {
      const group = topicGroups.get(q.topic) || [];
      group.push(q);
      topicGroups.set(q.topic, group);
    } else {
      noTopic.push(q);
    }
  }

  const afterTopicDedup: GeneratedQuestion[] = [];

  for (const [, group] of topicGroups) {
    if (group.length === 1) {
      afterTopicDedup.push(group[0]);
      continue;
    }

    // Sort by specificity descending — most grounded question first
    group.sort((a, b) => specificityScore(b) - specificityScore(a));

    const keptKeys = new Set<string>();

    for (const q of group) {
      const key = topicQualifier(q);

      if (keptKeys.size === 0) {
        // Always keep the top scorer
        afterTopicDedup.push(q);
        keptKeys.add(key);
        continue;
      }

      // 'generic' questions are subsumed when any specific question exists
      if (key === 'generic') continue;

      // Specific questions with a new qualifier survive (e.g., different products)
      if (!keptKeys.has(key)) {
        afterTopicDedup.push(q);
        keptKeys.add(key);
      }
    }
  }

  // Add untagged questions
  afterTopicDedup.push(...noTopic);

  // Phase 2: Legacy text-based dedup for anything that slipped through
  const seen = new Set<string>();
  const result: GeneratedQuestion[] = [];

  for (const question of afterTopicDedup) {
    const textKey = question.text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 50);

    const typeRoomKey = `${question.type}-${question.rooms?.join('-') || 'none'}`;

    if (!seen.has(textKey) && !seen.has(typeRoomKey)) {
      seen.add(textKey);
      seen.add(typeRoomKey);
      result.push(question);
    }
  }

  return result;
}

export interface GenerateQuestionsOptions {
  maxQuestions?: number;
  prioritizeBoostable?: boolean;
  includeGeneric?: boolean;
  projectId?: string;
  useAI?: boolean;
}

// ---------------------------------------------------------------------------
// AI Question Quality Gate
// ---------------------------------------------------------------------------

function validateAIQuestion(q: AIGeneratedQuestion): boolean {
  // Must reference at least one specific entity
  const hasSpecific = q.vendors.length > 0 || q.products.length > 0 || q.rooms.length > 0;

  // Must not reference unknown vendors
  const noUnknownVendor = !q.text.includes('Unknown Brand');

  // Must not ask about negatives
  const noNegatives = !/(regret|compromise|sacrifice|didn't make|cut|lost|wish you had)/i.test(q.text);

  // Must not be generic
  const notGeneric = !/(tell us about your|what inspired the|describe the overall)/i.test(q.text);

  return hasSpecific && noUnknownVendor && noNegatives && notGeneric;
}

function convertAIQuestionToGenerated(
  aiQ: AIGeneratedQuestion,
  contextLevel: ContextLevel
): GeneratedQuestion {
  const typeMap: Record<string, QuestionType> = {
    opening: 'generic',
    deep_dive: 'hero_piece',
    vendor_loyalty: 'vendor_loyalty',
    material_thread: 'material_theme',
    spatial_narrative: 'spatial_narrative',
    philosophy: 'generic',
  };

  return {
    id: randomUUID(),
    text: aiQ.text,
    contextLevel,
    type: typeMap[aiQ.type] || 'generic',
    rooms: aiQ.rooms,
    products: aiQ.products,
    vendors: aiQ.vendors,
    boostable: aiQ.boostable,
    pullQuotePotential: aiQ.type === 'philosophy' || aiQ.type === 'vendor_loyalty' ? 'high' : 'medium',
    topic: aiQ.topic,
  };
}

/**
 * Main function to generate interview questions based on project context.
 *
 * When `options.useAI` is true (or INTERVIEW_AI_QUESTIONS env var is set),
 * attempts AI question generation via the interview brief. Falls back to
 * template-based questions on failure or when AI is disabled.
 */
export async function generateInterviewQuestions(
  context: ProjectContext,
  options?: GenerateQuestionsOptions
): Promise<GeneratedQuestion[]> {
  const maxQuestions = options?.maxQuestions || 10;
  const includeGeneric = options?.includeGeneric !== false;
  const useAI = options?.useAI ?? (process.env.INTERVIEW_AI_QUESTIONS !== 'false' && !!process.env.ANTHROPIC_API_KEY);

  console.info('[generateInterviewQuestions]', {
    useAI,
    hasProjectId: !!options?.projectId,
    contextLevel: context.level,
    isProspective: context.isProspective,
    roomCount: context.rooms.length,
    selectionCount: context.selections.length,
    maxQuestions,
  });

  // Try AI question generation first
  if (useAI && options?.projectId) {
    try {
      console.info('[generateInterviewQuestions] attempting AI question generation');
      const brief = await buildInterviewBrief(options.projectId, {
        generateQuestions: true,
        questionCount: maxQuestions,
      });

      console.info('[generateInterviewQuestions] brief returned', {
        hasNarrative: !!brief.narrativeBrief?.visualImpression,
        aiQuestionCount: brief.aiQuestions?.length ?? 0,
      });

      if (brief.aiQuestions && brief.aiQuestions.length > 0) {
        // Validate and convert AI questions
        const validAIQuestions = brief.aiQuestions
          .filter(validateAIQuestion)
          .map((q) => convertAIQuestionToGenerated(q, context.level));

        console.info('[generateInterviewQuestions] AI questions validated', {
          total: brief.aiQuestions.length,
          valid: validAIQuestions.length,
          threshold: Math.floor(maxQuestions * 0.5),
        });

        if (validAIQuestions.length >= Math.floor(maxQuestions * 0.5)) {
          // AI produced enough valid questions — use them
          let questions = deduplicateSimilar(validAIQuestions);
          questions = orderByRoom(questions, context.rooms);

          // Supplement with template questions if AI returned fewer than target
          if (questions.length < maxQuestions) {
            const templateQuestions = generateTemplateQuestions(context, includeGeneric);
            const supplemental = templateQuestions.filter((tq) => {
              // Don't duplicate rooms already covered by AI
              const aiRooms = new Set(questions.flatMap((q) => q.rooms || []));
              return !(tq.rooms?.length === 1 && aiRooms.has(tq.rooms[0]));
            });
            questions.push(...supplemental);
            questions = deduplicateSimilar(questions);
            questions = orderByRoom(questions, context.rooms);
          }

          return questions.slice(0, maxQuestions);
        }
      }
    } catch (error) {
      console.warn('[generateInterviewQuestions] AI question generation failed, falling back to templates:', error);
    }
  }

  // Template-based fallback
  console.info('[generateInterviewQuestions] using template fallback', {
    reason: !useAI ? 'AI disabled' : !options?.projectId ? 'no projectId' : 'AI produced insufficient questions',
  });
  let questions = generateTemplateQuestions(context, includeGeneric);

  // Sort and select
  questions = prioritizeQuestions(questions, {
    preferHigherContext: true,
    preferBoostable: options?.prioritizeBoostable || false,
    preferPullQuotePotential: true,
  });

  // Deduplicate similar questions
  questions = deduplicateSimilar(questions);

  // Group by room for mental coherence (kitchen → living → dining → cross-room)
  questions = orderByRoom(questions, context.rooms);

  // Return top N
  return questions.slice(0, maxQuestions);
}

/**
 * Generate questions using the template system (Levels 0-5).
 * Extracted to allow fallback from AI generation.
 */
function generateTemplateQuestions(
  context: ProjectContext,
  includeGeneric: boolean
): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];

  if (context.isProspective) {
    questions.push(...generateProspectiveQuestions(context));
  } else if (includeGeneric) {
    questions.push(...generateLevel0Questions());
  }

  if (context.level >= 1) questions.push(...generateLevel1Questions(context));
  if (context.level >= 2) questions.push(...generateLevel2Questions(context));
  if (context.level >= 3) questions.push(...generateLevel3Questions(context));
  if (context.level >= 4) questions.push(...generateLevel4Questions(context));
  if (context.level >= 5) questions.push(...generateLevel5Questions(context));

  return questions;
}

/**
 * Group questions loosely by room so the designer's mental model stays coherent.
 * Order: 1-2 generic openers → Room 1 questions → Room 2 → ... → cross-room/spatial.
 */
function orderByRoom(
  questions: GeneratedQuestion[],
  rooms: RoomContext[]
): GeneratedQuestion[] {
  const opening: GeneratedQuestion[] = [];
  const roomBuckets = new Map<string, GeneratedQuestion[]>();
  const crossRoom: GeneratedQuestion[] = [];

  // Initialize buckets in room order
  for (const room of rooms) {
    roomBuckets.set(room.name, []);
  }

  for (const q of questions) {
    const qRooms = q.rooms || [];
    if (qRooms.length === 0) {
      if (q.type === 'generic' || q.type === 'prospective_vision' || q.contextLevel === 0) {
        opening.push(q);
      } else {
        crossRoom.push(q);
      }
    } else if (qRooms.length === 1 && roomBuckets.has(qRooms[0])) {
      roomBuckets.get(qRooms[0])!.push(q);
    } else {
      crossRoom.push(q);
    }
  }

  const result: GeneratedQuestion[] = [];
  // Start with 1-2 openers to ease in
  result.push(...opening.slice(0, 2));
  // Then room-by-room
  for (const [, bucket] of roomBuckets) {
    result.push(...bucket);
  }
  // Cross-room and spatial at the end
  result.push(...crossRoom);
  // Overflow openers
  result.push(...opening.slice(2));

  return result;
}

/**
 * Convert generated questions to the InterviewQuestion format used by the existing system
 */
export function toInterviewQuestion(question: GeneratedQuestion): {
  id: string;
  questionText: string;
  questionType: 'contextual';
  source: 'ai_classification';
  linkedImageId?: string;
  linkedProductId?: string;
  attributeType?: 'color' | 'material' | 'style' | 'mood' | 'element';
  attributeValue?: string;
  roomContext?: string;
  boostable: boolean;
  pullQuotePotential: 'high' | 'medium' | 'low';
  contextLevel: ContextLevel;
  questionCategory: QuestionType;
} {
  return {
    id: question.id,
    questionText: question.text,
    questionType: 'contextual',
    source: 'ai_classification',
    linkedImageId: question.linkedImageId,
    linkedProductId: question.linkedProductId,
    attributeType: question.attributeType,
    attributeValue: question.attributeValue,
    roomContext: question.roomContext || question.rooms?.[0],
    boostable: question.boostable,
    pullQuotePotential: question.pullQuotePotential,
    contextLevel: question.contextLevel,
    questionCategory: question.type,
  };
}
