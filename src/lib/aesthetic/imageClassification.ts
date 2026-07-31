import Anthropic from '@anthropic-ai/sdk';
import { MODEL_FOR } from '@/lib/ai/models';

const anthropic = new Anthropic();

export interface ImageClassification {
  colors: string[];      // green, navy, brass, warm white
  materials: string[];   // marble, oak, brass, velvet, linen, concrete
  styles: string[];      // modern, coastal, minimalist, mid-century
  mood: string[];        // airy, moody, warm, dramatic, serene
  elements: string[];    // pendant lighting, kitchen island, built-ins
  spaces: string[];      // kitchen, living room, primary bedroom
}

export async function classifyImage(imageUrl: string): Promise<ImageClassification> {
  const emptyResult: ImageClassification = { 
    colors: [], materials: [], styles: [], mood: [], elements: [], spaces: [] 
  };
  
  try {
    const response = await anthropic.messages.create({
      model: MODEL_FOR.extraction,
      thinking: { type: 'disabled' },
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'url',
                url: imageUrl,
              },
            },
            {
              type: 'text',
              text: `Analyze this interior design image and extract attributes for search/filtering. Return ONLY a valid JSON object with these arrays (use lowercase, common searchable terms):

{
  "colors": ["dominant colors visible - e.g., green, navy, brass, warm white, charcoal, cream, oak, walnut"],
  "materials": ["visible materials - e.g., marble, oak, walnut, brass, velvet, linen, concrete, terrazzo, leather, stone, tile"],
  "styles": ["design styles - e.g., modern, contemporary, traditional, coastal, minimalist, maximalist, mid-century, bohemian, industrial, scandinavian, transitional"],
  "mood": ["atmosphere/feeling - e.g., airy, moody, warm, bright, cozy, dramatic, serene, luxurious, casual"],
  "elements": ["notable design elements - e.g., pendant lighting, kitchen island, built-in shelving, statement tile, open plan, vaulted ceiling, bar seating"],
  "spaces": ["room types visible - e.g., kitchen, living room, dining room, bedroom, bathroom, office, entryway"]
}

Be specific but use common searchable terms interior designers would use. Include 2-5 items per category based on what's clearly visible. For colors, include both literal colors (green, blue) and material-colors (brass, oak, marble).`
            }
          ],
        }
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        colors: parsed.colors || [],
        materials: parsed.materials || [],
        styles: parsed.styles || [],
        mood: parsed.mood || [],
        elements: parsed.elements || [],
        spaces: parsed.spaces || [],
      };
    }
    
    return emptyResult;
  } catch (error) {
    console.error('Image classification failed:', error);
    return emptyResult;
  }
}

