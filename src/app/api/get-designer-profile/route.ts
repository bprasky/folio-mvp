import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }
    
    // In a real app, this would fetch from the database
    // For now, returning mock data based on the ID
    
    const mockProfile = {
      id: id,
      name: 'Sarah Chen',
      title: 'Principal Designer',
      location: 'San Francisco, CA',
      studio: 'Chen Design Studio',
      experience: 12,
      bio: 'Award-winning interior designer creating timeless, sophisticated spaces with a focus on sustainable luxury and modern minimalism.',
      profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?auto=format&fit=crop&w=400&q=80',
      coverImage: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80',
      social: {
        instagram: 'https://instagram.com/sarahchendesign',
        website: 'https://sarahchendesign.com',
        email: 'hello@sarahchendesign.com',
        phone: '+1 (415) 555-0198'
      },
      specialties: ['Modern Minimalism', 'Sustainable Design', 'Luxury Residential', 'Commercial Spaces'],
      education: ['MFA Interior Design, RISD', 'BA Architecture, UC Berkeley'],
      awards: ['AD100 Rising Star 2024', 'Elle Decor A-List 2023', 'ASID Designer of the Year 2022'],
      teamBio: 'Our team of 8 passionate designers brings diverse perspectives and expertise to every project, from concept to completion.',
      about: 'With over 12 years of experience, Sarah Chen has established herself as a leading voice in contemporary interior design. Her work seamlessly blends modern aesthetics with sustainable practices, creating spaces that are both beautiful and environmentally conscious. Sarah\'s approach to design is deeply rooted in understanding her clients\' lifestyles and translating their vision into reality.',
      stats: {
        projects: 89,
        followers: '8.3k',
        views: '2.1M'
      },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    };
    
    return NextResponse.json(mockProfile);
  } catch (error) {
    console.error('Error fetching designer profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
} 