export interface InterviewQuestion {
  id: string;
  layer: 1 | 2 | 3;
  question: string;
  purpose: string;
  fieldMapping: string; // Maps to OrgBioInterview field
  inputType: 'text' | 'textarea' | 'multiselect' | 'project-picker';
  options?: string[]; // For multiselect
  placeholder?: string;
}

export interface ContextualTrigger {
  triggerField: string;
  triggerContains: string[];
  followUpQuestion: InterviewQuestion;
}

// Layer 1: Foundation Questions
export const LAYER_1_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'origin-story',
    layer: 1,
    question: 'How did {orgName} get started?',
    purpose: 'Origin story',
    fieldMapping: 'originStory',
    inputType: 'textarea',
    placeholder: 'Tell us the story behind the studio...'
  },
  {
    id: 'philosophy',
    layer: 1,
    question: "In one sentence, what's your design philosophy?",
    purpose: 'Tagline/positioning',
    fieldMapping: 'philosophyStatement',
    inputType: 'text',
    placeholder: 'We believe that...'
  },
  {
    id: 'project-types',
    layer: 1,
    question: 'What types of projects do you focus on?',
    purpose: 'Service categories',
    fieldMapping: 'projectTypes',
    inputType: 'multiselect',
    options: [
      'Residential - Full Home',
      'Residential - Single Room',
      'Commercial Office',
      'Hospitality',
      'Retail',
      'Healthcare',
      'Multi-Family',
      'Historic Renovation',
      'New Construction',
      'Vacation/Second Homes'
    ]
  },
  {
    id: 'location-regions',
    layer: 1,
    question: 'Where are you based and what regions do you serve?',
    purpose: 'Geography',
    fieldMapping: 'location', // serviceRegions handled separately
    inputType: 'textarea',
    placeholder: 'Based in..., serving...'
  },
  {
    id: 'ideal-client',
    layer: 1,
    question: 'Who is your ideal client?',
    purpose: 'Target market',
    fieldMapping: 'idealClient',
    inputType: 'textarea',
    placeholder: 'Describe the clients you work best with...'
  }
];

// Layer 2: Contextual Follow-ups (triggered by L1 answers)
export const CONTEXTUAL_TRIGGERS: ContextualTrigger[] = [
  {
    triggerField: 'projectTypes',
    triggerContains: ['Residential'],
    followUpQuestion: {
      id: 'residential-draw',
      layer: 2,
      question: 'What draws you to residential work specifically?',
      purpose: 'Depth on residential focus',
      fieldMapping: 'layer2Responses.residentialDraw',
      inputType: 'textarea',
      placeholder: 'What makes residential projects meaningful to you...'
    }
  },
  {
    triggerField: 'originStory',
    triggerContains: ['partner', 'co-founder', 'we', 'founders'],
    followUpQuestion: {
      id: 'multiple-founders',
      layer: 2,
      question: "How do your individual perspectives shape the studio's voice?",
      purpose: 'Partnership dynamics',
      fieldMapping: 'layer2Responses.founderPerspectives',
      inputType: 'textarea',
      placeholder: 'Describe how different viewpoints come together...'
    }
  },
  {
    triggerField: 'philosophyStatement',
    triggerContains: ['sustainable', 'eco', 'green', 'environment'],
    followUpQuestion: {
      id: 'sustainability-approach',
      layer: 2,
      question: 'How does sustainability influence your material choices and vendor relationships?',
      purpose: 'Sustainability depth',
      fieldMapping: 'layer2Responses.sustainabilityApproach',
      inputType: 'textarea',
      placeholder: 'Describe your sustainable design practices...'
    }
  },
  {
    triggerField: 'projectTypes',
    triggerContains: ['Hospitality'],
    followUpQuestion: {
      id: 'hospitality-difference',
      layer: 2,
      question: 'How do you think about designing for guests versus residents?',
      purpose: 'Hospitality mindset',
      fieldMapping: 'layer2Responses.hospitalityApproach',
      inputType: 'textarea',
      placeholder: 'The difference between designing for visitors...'
    }
  },
  {
    triggerField: 'idealClient',
    triggerContains: ['high-end', 'luxury', 'premium', 'discerning'],
    followUpQuestion: {
      id: 'luxury-definition',
      layer: 2,
      question: 'What does luxury mean to you in design?',
      purpose: 'Luxury philosophy',
      fieldMapping: 'layer2Responses.luxuryDefinition',
      inputType: 'textarea',
      placeholder: 'How you define and deliver luxury...'
    }
  }
];

// Layer 3: Proof Points
export const LAYER_3_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'representative-project',
    layer: 3,
    question: "What's a project that best represents your work?",
    purpose: 'Links to existing project for case study',
    fieldMapping: 'representativeProjectId',
    inputType: 'project-picker',
    placeholder: 'Select a project...'
  },
  {
    id: 'recognition',
    layer: 3,
    question: 'What recognition has the studio received?',
    purpose: 'Prompts press/awards entry',
    fieldMapping: 'recognitionMentions',
    inputType: 'textarea',
    placeholder: 'Publications, awards, speaking engagements...'
  },
  {
    id: 'collaborators',
    layer: 3,
    question: 'Who do you collaborate with regularly?',
    purpose: 'Prompts vendor relationships',
    fieldMapping: 'collaboratorMentions',
    inputType: 'textarea',
    placeholder: 'Vendors, contractors, artisans you work with...'
  }
];

// Function to determine which L2 questions to show based on L1 answers
export function getContextualQuestions(
  layer1Answers: Record<string, string | string[]>
): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [];

  for (const trigger of CONTEXTUAL_TRIGGERS) {
    const answer = layer1Answers[trigger.triggerField];
    if (!answer) continue;

    const answerText = Array.isArray(answer) ? answer.join(' ') : answer;
    const matches = trigger.triggerContains.some(
      keyword => answerText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matches) {
      questions.push(trigger.followUpQuestion);
    }
  }

  return questions;
}

// Team member quiz questions
export interface TeamQuizQuestion {
  id: string;
  question: string;
  fieldMapping: string;
  inputType: 'text' | 'textarea' | 'date' | 'multiselect';
  placeholder?: string;
  options?: string[];
}

// Universal team member questions
export const TEAM_QUIZ_QUESTIONS: TeamQuizQuestion[] = [
  {
    id: 'join-date',
    question: 'When did you join {orgName}?',
    fieldMapping: 'joinDate',
    inputType: 'date'
  },
  {
    id: 'specialties',
    question: 'What are your specialty areas?',
    fieldMapping: 'specialties',
    inputType: 'multiselect',
    options: [
      'Kitchens',
      'Bathrooms',
      'Lighting Design',
      'FF&E',
      'Color & Materials',
      'Space Planning',
      'Project Management',
      'Client Relations',
      'Sustainability',
      'Historic Preservation',
      'Custom Millwork',
      'Art Curation'
    ]
  },
  {
    id: 'what-brought',
    question: 'What brought you to {orgName}?',
    fieldMapping: 'whatBroughtYou',
    inputType: 'textarea',
    placeholder: 'Share your journey to the studio...'
  },
  {
    id: 'role-in-process',
    question: "What's your role in the studio's process?",
    fieldMapping: 'roleInProcess',
    inputType: 'textarea',
    placeholder: 'Describe where you fit in the workflow...'
  },
  {
    id: 'proudest-project',
    question: 'What project are you most proud of?',
    fieldMapping: 'proudestProject',
    inputType: 'textarea',
    placeholder: 'Tell us about a project that stands out...'
  },
  {
    id: 'background',
    question: "What's your design background?",
    fieldMapping: 'background',
    inputType: 'textarea',
    placeholder: 'Education, prior experience, how you got into design...'
  }
];

// Contextual team questions based on org bio
export function getContextualTeamQuestions(orgBio?: {
  philosophyStatement?: string;
  projectTypes?: string[];
}): TeamQuizQuestion[] {
  const questions: TeamQuizQuestion[] = [];

  if (orgBio?.projectTypes?.some(t => t.toLowerCase().includes('residential'))) {
    questions.push({
      id: 'residential-contribution',
      question: "How does your work contribute to the studio's residential projects?",
      fieldMapping: 'contextualAnswers.residentialContribution',
      inputType: 'textarea',
      placeholder: 'Your unique contribution to residential work...'
    });
  }

  if (orgBio?.philosophyStatement?.toLowerCase().includes('sustainable')) {
    questions.push({
      id: 'sustainability-practices',
      question: 'What sustainable practices do you bring to your work?',
      fieldMapping: 'contextualAnswers.sustainabilityPractices',
      inputType: 'textarea',
      placeholder: 'Your approach to sustainable design...'
    });
  }

  if (orgBio?.projectTypes?.some(t => t.toLowerCase().includes('hospitality'))) {
    questions.push({
      id: 'hospitality-approach',
      question: 'How do you think about designing for guests vs. residents?',
      fieldMapping: 'contextualAnswers.hospitalityApproach',
      inputType: 'textarea',
      placeholder: 'Your hospitality design philosophy...'
    });
  }

  return questions;
}
