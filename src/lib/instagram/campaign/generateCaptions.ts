/**
 * Generate Instagram captions for different campaign post types
 */

interface ProjectData {
  title: string;
  description?: string;
  city?: string;
  regionState?: string;
  projectType?: string;
  designerName: string;
  designerInstagram?: string;
  slug: string;
}

interface CaptionInput {
  postType:
    | 'launch'
    | 'room_spotlight'
    | 'product_feature'
    | 'quote'
    | 'detail'
    | 'closer';
  project: ProjectData;
  context?: {
    roomName?: string;
    productName?: string;
    productBrand?: string;
    quoteText?: string;
    quoteAttribution?: string;
  };
}

/**
 * Generate hashtags based on project data
 */
function generateHashtags(project: ProjectData): string[] {
  const tags: string[] = [];

  // Core design tags
  tags.push('#interiordesign', '#designdetails', '#interiorstyling');

  // Location-based tags
  if (project.city) {
    const cityTag = project.city.toLowerCase().replace(/\s+/g, '');
    tags.push(`#${cityTag}design`, `#${cityTag}interiors`);
  }

  if (project.regionState) {
    const stateTag = project.regionState.toLowerCase().replace(/\s+/g, '');
    tags.push(`#${stateTag}design`);
  }

  // Project type tags
  if (project.projectType) {
    const typeTag = project.projectType.toLowerCase().replace(/\s+/g, '');
    tags.push(`#${typeTag}design`);
  }

  // Limit to ~8-10 tags per post
  return tags.slice(0, 10);
}

/**
 * Generate caption for a specific post type
 */
export function generateCaption(input: CaptionInput): {
  caption: string;
  hashtags: string[];
} {
  const { postType, project, context } = input;
  const projectLink = `folio.ad/p/${project.slug}`;
  const designerHandle = project.designerInstagram
    ? `@${project.designerInstagram.replace('@', '')}`
    : project.designerName;

  let caption = '';
  let hashtags: string[] = [];

  switch (postType) {
    case 'launch':
      caption = `${project.title} is now on Folio.

Every room. Every source. The story behind the design.

→ ${projectLink}`;
      hashtags = generateHashtags(project);
      break;

    case 'room_spotlight':
      if (!context?.roomName) {
        throw new Error('Room name required for room_spotlight caption');
      }

      caption = `${context.roomName} at ${project.title}.

${project.description || 'A space designed with intention and care.'}

📍 ${project.city ? `${project.city}, ${project.regionState || ''}` : 'See location'}
✏️ ${designerHandle}

All sources tagged in full project.`;

      hashtags = [
        ...generateHashtags(project),
        `#${context.roomName.toLowerCase().replace(/\s+/g, '')}design`,
      ];
      break;

    case 'product_feature':
      if (!context?.productName || !context?.productBrand) {
        throw new Error('Product name and brand required for product_feature caption');
      }

      caption = `${context.productName} by ${context.productBrand}

Specified for ${project.title}${context.roomName ? `—anchoring the ${context.roomName.toLowerCase()}` : ''}.

Full sources: ${projectLink}`;

      hashtags = [
        '#designsourcing',
        '#interiordesign',
        `#${context.productBrand.toLowerCase().replace(/\s+/g, '')}`,
        '#furniturefocus',
      ];
      break;

    case 'quote':
      if (!context?.quoteText) {
        throw new Error('Quote text required for quote caption');
      }

      const attribution = context.quoteAttribution || project.designerName;

      caption = `On the vision for ${project.title}:

"${context.quoteText}"

The full story: ${projectLink}`;

      hashtags = ['#designstory', '#interiordesign', '#designthinking'];
      break;

    case 'detail':
      caption = `The details at ${project.title}.

${project.description || 'Materials, textures, craft.'}

Full project on Folio.`;

      hashtags = ['#designdetails', '#interiordetails', '#materialmatters'];
      break;

    case 'closer':
      caption = `${project.title}—the full story is on Folio.

Every room. Every source. The design decisions that shaped it.

→ ${projectLink}`;

      hashtags = generateHashtags(project);
      break;

    default:
      throw new Error(`Unknown post type: ${postType}`);
  }

  return {
    caption,
    hashtags: hashtags.slice(0, 15), // Instagram allows max 30, but we keep it reasonable
  };
}

/**
 * Generate complete captions.txt file content for a campaign
 */
export function generateCaptionsFile(
  captions: Array<{
    postNumber: number;
    postType: string;
    caption: string;
    hashtags: string[];
  }>
): string {
  let content = `Instagram Campaign Captions\n`;
  content += `============================\n\n`;
  content += `Copy and paste these captions when posting to Instagram.\n`;
  content += `Each section corresponds to a numbered post in your campaign.\n\n`;
  content += `---\n\n`;

  captions.forEach(({ postNumber, postType, caption, hashtags }) => {
    content += `POST ${postNumber} (${postType.toUpperCase()})\n`;
    content += `${'='.repeat(40)}\n\n`;
    content += `${caption}\n\n`;
    content += `${hashtags.join(' ')}\n\n`;
    content += `---\n\n`;
  });

  content += `\nTIPS FOR POSTING:\n`;
  content += `- Post 2-3 times per week for optimal engagement\n`;
  content += `- Mix with other projects to keep your feed varied\n`;
  content += `- Tag vendors and collaborators when posting product features\n`;
  content += `- Use Instagram Stories to tease upcoming posts\n`;
  content += `- Engage with comments within the first hour for better reach\n\n`;

  return content;
}
