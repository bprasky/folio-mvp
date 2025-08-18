import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    console.log('🧪 Testing festival creation with existing user...');
    
    // Get the first user from the database
    const existingUser = await prisma.user.findFirst();
    if (!existingUser) {
      return NextResponse.json({ error: 'No users found in database' }, { status: 500 });
    }
    
    console.log('👤 Using user:', existingUser.id, existingUser.email);
    
    // Try to create a festival with this user ID
    const festival = await prisma.event.create({
      data: {
        title: 'Test Festival via API',
        description: 'Test Description via API',
        location: 'Test Location via API',
        startDate: new Date('2025-12-20T10:00:00Z'),
        endDate: new Date('2025-12-22T18:00:00Z'),
        type: 'festival',
        isPublic: true,
        isApproved: true,
        requiresApproval: false,
        createdById: existingUser.id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });
    
    console.log('✅ Festival created successfully:', festival.id);
    
    // Clean up - delete the test festival
    await prisma.event.delete({
      where: { id: festival.id }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Festival creation test passed',
      festivalId: festival.id,
      createdBy: festival.createdBy
    });
  } catch (error) {
    console.error('❌ Festival creation test failed:', error);
    return NextResponse.json(
      { error: 'Festival creation test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 