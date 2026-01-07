import { NextRequest, NextResponse } from 'next/server';

// Mock event import function - replace with actual web scraping logic
async function importEventFromUrl(url: string) {
  // This is a simplified mock implementation
  // In production, you would use web scraping libraries to extract event data
  
  const urlLower = url.toLowerCase();
  let extractedData: any = {};
  
  // Mock different sources
  if (urlLower.includes('eventbrite')) {
    extractedData = {
      title: "Sample Eventbrite Event",
      description: "Join us for an amazing event with great speakers and networking opportunities.",
      startDate: "2024-12-15T19:00:00",
      endDate: "2024-12-15T22:00:00",
      location: "Eventbrite Venue, New York, NY",
      isVirtual: false,
      eventTypes: ["PANEL"],
      includesFood: true,
      imageUrl: "https://via.placeholder.com/400x300?text=Eventbrite+Event"
    };
  } else if (urlLower.includes('instagram')) {
    extractedData = {
      title: "Instagram Story Event",
      description: "Quick popup event announced on Instagram stories.",
      startDate: "2024-12-10T18:00:00",
      endDate: "2024-12-10T20:00:00",
      location: "Instagram Location",
      isVirtual: false,
      eventTypes: ["PARTY"],
      includesFood: false,
      imageUrl: "https://via.placeholder.com/400x300?text=Instagram+Event"
    };
  } else if (urlLower.includes('archinect')) {
    extractedData = {
      title: "Architecture Exhibition Opening",
      description: "Opening reception for the latest architecture exhibition featuring local designers.",
      startDate: "2024-12-20T17:00:00",
      endDate: "2024-12-20T21:00:00",
      location: "Architecture Gallery, Los Angeles, CA",
      isVirtual: false,
      eventTypes: ["EXHIBITION", "PARTY"],
      includesFood: true,
      imageUrl: "https://via.placeholder.com/400x300?text=Architecture+Event"
    };
  } else if (urlLower.includes('linkedin')) {
    extractedData = {
      title: "LinkedIn Networking Event",
      description: "Professional networking event for design industry professionals.",
      startDate: "2024-12-12T19:00:00",
      endDate: "2024-12-12T21:00:00",
      location: "LinkedIn Office, San Francisco, CA",
      isVirtual: false,
      eventTypes: ["NETWORKING"],
      includesFood: true,
      imageUrl: "https://via.placeholder.com/400x300?text=LinkedIn+Event"
    };
  } else {
    // Generic fallback
    extractedData = {
      title: "Imported Event",
      description: "Event imported from external source. Please review and edit the details.",
      startDate: "2024-12-25T18:00:00",
      endDate: "2024-12-25T20:00:00",
      location: "TBD",
      isVirtual: false,
      eventTypes: ["OTHER"],
      includesFood: false,
      imageUrl: "https://via.placeholder.com/400x300?text=Imported+Event"
    };
  }
  
  // Add source metadata
  extractedData.importSource = url;
  extractedData.importedAt = new Date().toISOString();
  
  return extractedData;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    
    if (!source) {
      return NextResponse.json(
        { error: 'Source URL is required' },
        { status: 400 }
      );
    }
    
    // Validate URL format
    try {
      new URL(source);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    // Import event data from the URL
    const eventData = await importEventFromUrl(source);
    
    // Log the import attempt for analytics
    console.log('Event import attempt:', {
      source: source,
      extractedFields: Object.keys(eventData),
      eventData: eventData, // Log full data for debugging
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(eventData);
    
  } catch (error) {
    console.error('Error importing event:', error);
    return NextResponse.json(
      { error: 'Failed to import event from the provided URL. Please check the link and try again.' },
      { status: 500 }
    );
  }
} 