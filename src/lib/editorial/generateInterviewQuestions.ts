import { ImageClassification } from '@/lib/aesthetic/imageClassification';

export interface ContextualQuestion {
  question: string;
  attribute: string;      // What we're verifying (e.g., "green")
  attributeType: string;  // Category (e.g., "colors")
  confidence: 'verify' | 'explore';
  imageId?: string;       // Which image this came from
}

const NEUTRAL_COLORS = ['white', 'black', 'gray', 'grey', 'beige', 'cream', 'ivory'];

export function generateContextualQuestions(
  classifications: Array<{ classification: ImageClassification; imageId: string; room?: string | null }>,
  projectRoomType?: string
): ContextualQuestion[] {
  const questions: ContextualQuestion[] = [];
  
  // Aggregate attributes across all images
  const allColors = [...new Set(classifications.flatMap(c => c.classification.colors || []))];
  const allMaterials = [...new Set(classifications.flatMap(c => c.classification.materials || []))];
  const allStyles = [...new Set(classifications.flatMap(c => c.classification.styles || []))];
  const allMoods = [...new Set(classifications.flatMap(c => c.classification.mood || []))];
  const allElements = [...new Set(classifications.flatMap(c => c.classification.elements || []))];
  
  const room = projectRoomType || 'space';
  
  // COLOR QUESTIONS - high verification value
  const interestingColors = allColors.filter(c => !NEUTRAL_COLORS.includes(c.toLowerCase()));
  
  if (interestingColors.length > 0) {
    const color = interestingColors[0];
    const sourceImage = classifications.find(c => 
      c.classification.colors?.includes(color)
    );
    
    questions.push({
      question: `What drew you to ${color} for the ${room}?`,
      attribute: color,
      attributeType: 'colors',
      confidence: 'verify',
      imageId: sourceImage?.imageId,
    });
  }
  
  // MATERIAL QUESTIONS - good for vendor attribution
  if (allMaterials.length > 0) {
    const primaryMaterial = allMaterials[0];
    const sourceImage = classifications.find(c => 
      c.classification.materials?.includes(primaryMaterial)
    );
    
    questions.push({
      question: `Tell us about the ${primaryMaterial} - what led you to that choice?`,
      attribute: primaryMaterial,
      attributeType: 'materials',
      confidence: 'verify',
      imageId: sourceImage?.imageId,
    });
    
    // Material palette question if multiple materials
    if (allMaterials.length > 2) {
      const palette = allMaterials.slice(0, 3).join(', ');
      questions.push({
        question: `The material palette - ${palette} - how did that come together?`,
        attribute: allMaterials.slice(0, 3).join(','),
        attributeType: 'materials',
        confidence: 'explore',
      });
    }
  }
  
  // STYLE QUESTIONS - verify aesthetic classification
  if (allStyles.length > 0) {
    const primaryStyle = allStyles[0];
    const stylePhrase = allStyles.length > 1 
      ? `${allStyles[0]} with ${allStyles[1]} influences`
      : allStyles[0];
    
    questions.push({
      question: `The space feels very ${stylePhrase} - was that the direction from the start, or did it evolve?`,
      attribute: primaryStyle,
      attributeType: 'styles',
      confidence: 'verify',
    });
  }
  
  // MOOD QUESTIONS - captures designer intent
  if (allMoods.length > 0) {
    const mood = allMoods[0];
    questions.push({
      question: `There's a ${mood} atmosphere throughout. How did you achieve that feeling?`,
      attribute: mood,
      attributeType: 'mood',
      confidence: 'verify',
    });
  }
  
  // ELEMENT QUESTIONS - specific standout features
  const standoutElements = allElements.filter(e => 
    /lighting|island|ceiling|tile|fireplace|shelving|window/i.test(e)
  );
  
  if (standoutElements.length > 0) {
    const element = standoutElements[0];
    const sourceImage = classifications.find(c => 
      c.classification.elements?.includes(element)
    );
    
    questions.push({
      question: `The ${element} really anchors the space. What's the story behind that choice?`,
      attribute: element,
      attributeType: 'elements',
      confidence: 'verify',
      imageId: sourceImage?.imageId,
    });
  }
  
  // Limit to 3-4 contextual questions to not overwhelm
  return questions.slice(0, 4);
}

