/**
 * Natural Language Query Parser
 * Extracts structured filters from plain English queries
 */

import { DirectoryFilters } from '@/types/directory';

export interface ParsedQuery {
  filters: DirectoryFilters;
  interpretedQuery?: string; // Human-readable interpretation
}

/**
 * Parse natural language query into structured filters
 */
export function parseNaturalQuery(
  query: string,
  availableProjects: Array<{ id: string; title: string }>,
  availableVendors: string[],
  availableRooms: string[]
): ParsedQuery {
  const lowerQuery = query.toLowerCase().trim();
  const filters: DirectoryFilters = {};
  const interpretations: string[] = [];

  // Extract room mentions
  const roomKeywords: Record<string, string[]> = {
    'living room': ['living room', 'living', 'lounge', 'family room'],
    'kitchen': ['kitchen', 'cooking'],
    'bedroom': ['bedroom', 'master bedroom', 'guest bedroom'],
    'bathroom': ['bathroom', 'bath', 'powder room', 'master bath'],
    'dining room': ['dining room', 'dining', 'dinner'],
    'office': ['office', 'study', 'workspace'],
    'entry': ['entry', 'foyer', 'entryway', 'hall'],
    'exterior': ['exterior', 'outdoor', 'outside', 'patio'],
  };

  for (const [room, keywords] of Object.entries(roomKeywords)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      // Try to match exact room name from available rooms first
      const matchedRoom = availableRooms.find(r => 
        r.toLowerCase().includes(room) || room.includes(r.toLowerCase())
      );
      if (matchedRoom) {
        filters.room = matchedRoom;
        interpretations.push(`in ${matchedRoom}`);
      } else {
        filters.room = room;
        interpretations.push(`in ${room}`);
      }
      break;
    }
  }

  // Extract project names
  for (const project of availableProjects) {
    const projectTitleLower = project.title.toLowerCase();
    // Check if project name appears in query
    if (lowerQuery.includes(projectTitleLower) || 
        projectTitleLower.split(' ').some(word => 
          word.length > 3 && lowerQuery.includes(word)
        )) {
      filters.project = project.id;
      interpretations.push(`for project "${project.title}"`);
      break;
    }
  }

  // Extract vendor names
  for (const vendor of availableVendors) {
    const vendorLower = vendor.toLowerCase();
    if (lowerQuery.includes(vendorLower) || 
        vendorLower.split(' ').some(word => 
          word.length > 3 && lowerQuery.includes(word)
        )) {
      filters.vendor = vendor;
      interpretations.push(`from ${vendor}`);
      break;
    }
  }

  // Extract product types/categories
  const categoryKeywords: Record<string, string[]> = {
    'Lighting': ['lighting', 'light', 'lamp', 'chandelier', 'pendant', 'sconce', 'fixture'],
    'Seating': ['chair', 'chairs', 'sofa', 'couch', 'settee', 'bench', 'stool'],
    'Tables': ['table', 'desk', 'console', 'side table', 'coffee table'],
    'Storage': ['cabinet', 'dresser', 'chest', 'wardrobe', 'shelving'],
    'Textiles': ['rug', 'carpet', 'pillow', 'throw', 'curtain', 'drapery'],
    'Decorative': ['mirror', 'art', 'sculpture', 'vase', 'accessory'],
    'Hardware': ['faucet', 'fixture', 'handle', 'knob', 'pull'],
    'Flooring': ['tile', 'wood', 'stone', 'marble', 'flooring'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      filters.category = category;
      interpretations.push(`${category.toLowerCase()}`);
      break;
    }
  }

  // Extract remaining keywords (for general search)
  // Remove already matched terms
  let remainingQuery = lowerQuery;
  if (filters.room) {
    roomKeywords[filters.room]?.forEach(kw => {
      remainingQuery = remainingQuery.replace(kw, '');
    });
  }
  if (filters.vendor) {
    remainingQuery = remainingQuery.replace(filters.vendor.toLowerCase(), '');
  }
  if (filters.category) {
    categoryKeywords[filters.category]?.forEach(kw => {
      remainingQuery = remainingQuery.replace(kw, '');
    });
  }
  
  // Remove common stop words
  const stopWords = ['what', 'did', 'we', 'use', 'in', 'for', 'the', 'a', 'an', 'from', 'all', 'everything'];
  remainingQuery = remainingQuery
    .split(' ')
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .join(' ')
    .trim();

  if (remainingQuery.length > 0) {
    filters.search = remainingQuery;
    interpretations.push(`matching "${remainingQuery}"`);
  }

  const interpretedQuery = interpretations.length > 0
    ? `Showing: ${interpretations.join(', ')}`
    : undefined;

  return { filters, interpretedQuery };
}

