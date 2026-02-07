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

  // Original question metadata (for compatibility with existing system)
  linkedImageId?: string;
  linkedProductId?: string;
  attributeType?: 'color' | 'material' | 'style' | 'mood' | 'element';
  attributeValue?: string;
  roomContext?: string;
}

// Level 0: Generic fallback questions (current state)
const LEVEL_0_QUESTIONS = {
  layer1: [
    {
      text: 'Tell us about this project and what made it special.',
      helper: 'Share what drew you to this project or made it meaningful.',
    },
    {
      text: 'What was the initial vision for this space?',
      helper: 'Describe the concept or direction from the beginning.',
    },
    {
      text: 'How would you describe the overall aesthetic?',
      helper: 'Think about the feeling, style, and mood of the space.',
    },
    {
      text: 'What was your favorite part of this project?',
      helper: 'Share a moment, detail, or outcome that stands out.',
    },
  ],
  layer2: [
    {
      text: 'Who is this home for and how did that influence your decisions?',
      helper: 'Consider how the client shaped the design direction.',
    },
    {
      text: 'What challenges did you navigate during this project?',
      helper: 'Focus on how you solved problems creatively.',
    },
    {
      text: 'Is there a piece in this project that anchors the whole design?',
      helper: 'Think about a signature element that ties everything together.',
    },
    {
      text: 'What do you hope people feel when they walk into this space?',
      helper: 'Describe the emotional impact you were aiming for.',
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
    },
    {
      text: 'How do you envision the finished space feeling when it all comes together?',
      helper: 'Describe the mood, the atmosphere, the experience you\'re designing toward.',
    },
    {
      text: 'Walk us through how you arrived at these selections.',
      helper: 'Share the story of what drew you to these particular pieces.',
    },
    {
      text: 'Has the project evolved from the original vision at all?',
      helper: 'Let the story of the design journey unfold naturally.',
    },
  ],
  layer2: [
    {
      text: 'What\'s the anchor piece that the rest of the design revolves around?',
      helper: 'Think about which selection set the tone for everything else.',
    },
    {
      text: 'How are you thinking about the relationship between the rooms?',
      helper: 'Describe the flow and continuity you\'re creating across spaces.',
    },
    {
      text: 'What do you want your client to feel the first time they walk in?',
      helper: 'Describe the arrival moment you\'re designing.',
    },
    {
      text: 'Is there a material or finish that became the thread tying this project together?',
      helper: 'Think about the unifying elements that create coherence.',
    },
  ],
};

/**
 * Generate prospective project questions (planning/design phase).
 * These replace generic questions when the project has generated images.
 */
function generateProspectiveQuestions(context: ProjectContext): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];

  for (const q of PROSPECTIVE_QUESTIONS.layer1) {
    questions.push({
      id: `prospective-${randomUUID()}`,
      text: q.text,
      helper: q.helper,
      contextLevel: 1,
      type: 'prospective_vision',
      boostable: false,
      pullQuotePotential: 'medium',
    });
  }

  for (const q of PROSPECTIVE_QUESTIONS.layer2) {
    questions.push({
      id: `prospective-${randomUUID()}`,
      text: q.text,
      helper: q.helper,
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
        contextLevel: 1,
        type: 'prospective_vision',
        vendors: [vendor.name],
        rooms: vendor.rooms,
        boostable: true,
        pullQuotePotential: 'high',
      });
    }
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
      contextLevel: 4,
      type: 'spatial_flow',
      boostable: false,
      pullQuotePotential: 'high',
    });

    questions.push({
      id: `l4-transitions-${randomUUID()}`,
      text: `How did you create continuity between spaces while giving each room its own character?`,
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
      contextLevel: 5,
      type: 'decision_journey',
      boostable: false,
      pullQuotePotential: 'high',
    });

    questions.push({
      id: `l5-conviction-${randomUUID()}`,
      text: `Was there a piece you had to fight for—one that required conviction to get into the project?`,
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
 * Remove duplicate or very similar questions
 */
function deduplicateSimilar(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  const seen = new Set<string>();
  const result: GeneratedQuestion[] = [];

  for (const question of questions) {
    // Create a rough deduplication key
    const key = question.text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 50);

    // Also dedupe by type + room combination
    const typeRoomKey = `${question.type}-${question.rooms?.join('-') || 'none'}`;

    if (!seen.has(key) && !seen.has(typeRoomKey)) {
      seen.add(key);
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
}

/**
 * Main function to generate interview questions based on project context
 */
export async function generateInterviewQuestions(
  context: ProjectContext,
  options?: GenerateQuestionsOptions
): Promise<GeneratedQuestion[]> {
  const maxQuestions = options?.maxQuestions || 10;
  const includeGeneric = options?.includeGeneric !== false;

  let questions: GeneratedQuestion[] = [];

  // For prospective projects, use prospective-tone questions instead of generic ones.
  // These invite the designer to share their evolving vision naturally.
  if (context.isProspective) {
    questions.push(...generateProspectiveQuestions(context));
  } else if (includeGeneric) {
    // Completed projects get standard generic fallback questions
    questions.push(...generateLevel0Questions());
  }

  // Add questions for each available level
  if (context.level >= 1) {
    questions.push(...generateLevel1Questions(context));
  }

  if (context.level >= 2) {
    questions.push(...generateLevel2Questions(context));
  }

  if (context.level >= 3) {
    questions.push(...generateLevel3Questions(context));
  }

  if (context.level >= 4) {
    questions.push(...generateLevel4Questions(context));
  }

  if (context.level >= 5) {
    questions.push(...generateLevel5Questions(context));
  }

  // Sort and select
  questions = prioritizeQuestions(questions, {
    preferHigherContext: true,
    preferBoostable: options?.prioritizeBoostable || false,
    preferPullQuotePotential: true,
  });

  // Deduplicate similar questions
  questions = deduplicateSimilar(questions);

  // Return top N
  return questions.slice(0, maxQuestions);
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
