import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const profileData = await request.json();
    
    if (!profileData.id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }
    
    // In a real app, this would update the designer profile in the database
    // For now, we'll just validate the data and return success
    
    const updatedProfile = {
      ...profileData,
      updatedAt: new Date().toISOString()
    };
    
    console.log('Updated designer profile:', updatedProfile);
    
    return NextResponse.json({ 
      success: true, 
      profile: updatedProfile 
    });
  } catch (error) {
    console.error('Error updating designer profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const profileData = await request.json();
    const { id, ...updateData } = profileData;

    if (!id) {
      return NextResponse.json(
        { error: 'Designer ID is required' },
        { status: 400 }
      );
    }

    // Update the designer profile in the database
    const updatedDesigner = await prisma.user.update({
      where: { id },
      data: {
        name: updateData.name,
        bio: updateData.title || updateData.bio,
        profileImage: updateData.profileImage,
        location: updateData.location,
        specialties: updateData.specialties || [],
        website: updateData.social?.website || updateData.website,
        instagram: updateData.social?.instagram || updateData.instagram,
        linkedin: updateData.social?.linkedin || updateData.linkedin,
        // Store additional profile data in a JSON field
        // Note: We'll need to add a JSON field to the schema for this
        // For now, we'll store the essential data in existing fields
      },
    });

    console.log('Profile updated successfully:', updatedDesigner);

    return NextResponse.json(updatedDesigner, { status: 200 });

  } catch (error) {
    console.error('Error updating designer profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 