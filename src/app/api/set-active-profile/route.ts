import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { profileId, role } = await request.json();
    
    if (!profileId || !role) {
      return NextResponse.json(
        { error: 'Profile ID and role are required' },
        { status: 400 }
      );
    }
    
    // In a real app, this would update the user's activeProfileId in the database
    // For now, we'll just return success and let the frontend handle localStorage
    
    return NextResponse.json({ 
      success: true, 
      activeProfileId: profileId,
      role: role
    });
  } catch (error) {
    console.error('Error setting active profile:', error);
    return NextResponse.json(
      { error: 'Failed to set active profile' },
      { status: 500 }
    );
  }
} 