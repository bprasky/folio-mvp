import { NextRequest, NextResponse } from 'next/server';

// Mock AI parsing function - replace with actual OpenAI integration
async function parseEventInput(input: string) {
  // This is a simplified mock implementation
  // In production, you would use OpenAI's API to parse the input
  
  const lowerInput = input.toLowerCase();
  const extractedData: any = {};
  
  // Extract title (simple heuristic)
  if (lowerInput.includes('party') || lowerInput.includes('event') || lowerInput.includes('opening')) {
    const words = input.split(' ');
    const titleIndex = words.findIndex(word => 
      word.toLowerCase().includes('party') || 
      word.toLowerCase().includes('event') || 
      word.toLowerCase().includes('opening')
    );
    if (titleIndex !== -1) {
      extractedData.title = words.slice(0, titleIndex + 3).join(' ').replace(/[^\w\s]/g, '');
    }
  }
  
  // Extract location
  const locationKeywords = ['at', 'in', 'on', 'near'];
  for (const keyword of locationKeywords) {
    if (lowerInput.includes(keyword)) {
      const parts = input.split(keyword);
      if (parts.length > 1) {
        const locationPart = parts[1].trim().split(' ').slice(0, 3).join(' ');
        if (locationPart.length > 2) {
          extractedData.location = locationPart;
          break;
        }
      }
    }
  }
  
  // Extract date/time
  const datePatterns = [
    /(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(today|tomorrow)/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)/i
  ];
  
  for (const pattern of datePatterns) {
    const match = input.match(pattern);
    if (match) {
      extractedData.startDate = match[0];
      break;
    }
  }
  
  // Extract time
  const timePattern = /(\d{1,2}:\d{2}\s*(am|pm)?)/i;
  const timeMatch = input.match(timePattern);
  if (timeMatch) {
    extractedData.time = timeMatch[0];
  }
  
  // Determine event type
  const eventTypes = [];
  if (lowerInput.includes('party') || lowerInput.includes('celebration')) {
    eventTypes.push('PARTY');
  }
  if (lowerInput.includes('panel') || lowerInput.includes('discussion')) {
    eventTypes.push('PANEL');
  }
  if (lowerInput.includes('workshop') || lowerInput.includes('class')) {
    eventTypes.push('WORKSHOP');
  }
  if (lowerInput.includes('exhibition') || lowerInput.includes('show')) {
    eventTypes.push('EXHIBITION');
  }
  if (lowerInput.includes('happy hour') || lowerInput.includes('drinks')) {
    eventTypes.push('HAPPY_HOUR');
  }
  if (lowerInput.includes('lunch') || lowerInput.includes('dinner')) {
    eventTypes.push('MEAL');
  }
  if (lowerInput.includes('product') && lowerInput.includes('reveal')) {
    eventTypes.push('PRODUCT_REVEAL');
  }
  
  if (eventTypes.length > 0) {
    extractedData.eventTypes = eventTypes;
  }
  
  // Check for food/drinks
  if (lowerInput.includes('food') || lowerInput.includes('drinks') || lowerInput.includes('refreshments')) {
    extractedData.includesFood = true;
  }
  
  // Check for virtual events
  if (lowerInput.includes('virtual') || lowerInput.includes('online') || lowerInput.includes('zoom')) {
    extractedData.isVirtual = true;
  }
  
  // Check for sponsored events
  if (lowerInput.includes('sponsored') || lowerInput.includes('promoted')) {
    extractedData.isSponsored = true;
    extractedData.promotionTier = 1;
  }
  
  // Generate follow-up questions for missing required fields
  const followUpQuestions = [];
  
  if (!extractedData.title) {
    followUpQuestions.push("What's the name of your event?");
  }
  
  if (!extractedData.location && !extractedData.isVirtual) {
    followUpQuestions.push("Where will this event take place?");
  }
  
  if (!extractedData.startDate) {
    followUpQuestions.push("When is this event happening?");
  }
  
  if (!extractedData.eventTypes || extractedData.eventTypes.length === 0) {
    followUpQuestions.push("What type of event is this? (e.g., party, workshop, panel)");
  }
  
  // Return structured response
  return {
    extractedData,
    followUpQuestion: followUpQuestions.length > 0 ? followUpQuestions[0] : null,
    confidence: 0.7 // Mock confidence score
  };
}

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();
    
    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input. Please provide a text description of your event.' },
        { status: 400 }
      );
    }
    
    // Parse the input using AI
    const result = await parseEventInput(input);
    
    // Log the parsing attempt for analytics
    console.log('Event parsing attempt:', {
      input: input.substring(0, 100) + '...',
      extractedFields: Object.keys(result.extractedData),
      confidence: result.confidence,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error parsing event input:', error);
    return NextResponse.json(
      { error: 'Failed to parse event input. Please try again.' },
      { status: 500 }
    );
  }
} 