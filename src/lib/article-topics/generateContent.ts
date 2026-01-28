/**
 * AI-Powered Topic Content Generation
 * Generates article topics from trend signals
 */

interface TrendSignalInput {
  topic: string;
  topicType: string;
  growthRate: number;
  topProducts: string[];
}

interface GeneratedContent {
  title: string;
  promptQuestion: string;
  suggestedTags: string[];
}

/**
 * Generate article topic content from a trend signal
 * Uses templates for now, can be enhanced with AI later
 */
export async function generateTopicContent(
  signal: TrendSignalInput
): Promise<GeneratedContent> {
  const { topic, topicType, growthRate } = signal;

  // Capitalize first letter of topic
  const capitalizedTopic = topic.charAt(0).toUpperCase() + topic.slice(1);

  // Template-based generation based on topic type
  const templates = getTemplatesForType(topicType);
  const template = templates[Math.floor(Math.random() * templates.length)];

  const title = template.title.replace('{topic}', capitalizedTopic);
  const promptQuestion = template.question.replace('{topic}', topic.toLowerCase());

  // Generate suggested tags
  const suggestedTags = generateTags(topic, topicType);

  return {
    title,
    promptQuestion,
    suggestedTags,
  };
}

interface TopicTemplate {
  title: string;
  question: string;
}

function getTemplatesForType(topicType: string): TopicTemplate[] {
  const templates: Record<string, TopicTemplate[]> = {
    material: [
      {
        title: 'The Quiet Return of {topic}',
        question: 'What draws you to {topic} right now?',
      },
      {
        title: '{topic}: A Material Moment',
        question: 'How are you incorporating {topic} into your current work?',
      },
      {
        title: 'Why {topic} Is Having Its Moment',
        question: 'What makes {topic} feel right for today\'s interiors?',
      },
    ],
    color: [
      {
        title: 'The {topic} Wave',
        question: 'Where are you seeing {topic} in your projects lately?',
      },
      {
        title: '{topic}: Beyond the Trend',
        question: 'What makes {topic} resonate with your clients?',
      },
    ],
    style: [
      {
        title: 'The {topic} Movement',
        question: 'How would you describe the essence of {topic} style?',
      },
      {
        title: '{topic} Design: Past, Present, Future',
        question: 'What aspect of {topic} design speaks to you most?',
      },
    ],
    shape: [
      {
        title: 'Curves and Lines: The Rise of {topic}',
        question: 'Why do you think {topic} shapes are gaining popularity?',
      },
    ],
    product: [
      {
        title: 'Design Voices on {topic}',
        question: 'What\'s your experience working with {topic}?',
      },
    ],
  };

  return templates[topicType] || templates.material;
}

function generateTags(topic: string, topicType: string): string[] {
  const tags = [topic.toLowerCase()];

  // Add type-based tags
  const typeTagMap: Record<string, string[]> = {
    material: ['materials', 'texture', 'surfaces'],
    color: ['color', 'palette', 'hues'],
    style: ['style', 'aesthetic', 'design-movement'],
    shape: ['form', 'geometry', 'silhouette'],
    product: ['products', 'furniture', 'decor'],
  };

  const typeTags = typeTagMap[topicType] || [];
  tags.push(...typeTags.slice(0, 2));

  return tags;
}

/**
 * Validate that generated content meets quality standards
 */
export function validateGeneratedContent(content: GeneratedContent): boolean {
  // Title should be non-empty and reasonable length
  if (!content.title || content.title.length < 10 || content.title.length > 100) {
    return false;
  }

  // Question should be a question
  if (!content.promptQuestion || !content.promptQuestion.includes('?')) {
    return false;
  }

  // Should have at least one tag
  if (!content.suggestedTags || content.suggestedTags.length === 0) {
    return false;
  }

  return true;
}
