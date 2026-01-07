import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing simple festival creation...');
    
    // First, check if we have any users
    const users = await prisma.user.findMany({
      take: 3,
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });
    
    console.log('👥 Available users:', users);
    
    if (users.length === 0) {
      return NextResponse.json({
        error: 'No users found',
        message: 'Cannot create festival without users'
      });
    }
    
    // Use the first available user
    const userId = users[0].id;
    console.log('✅ Using user ID:', userId);
    
    // Try to create a simple festival
    const festival = await prisma.event.create({
      data: {
        title: 'Test Festival',
        description: 'A test festival for debugging',
        location: 'Test Location',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-03'),
        type: 'festival',
        isPublic: true,
        isApproved: true,
        requiresApproval: false,
        createdById: userId
      }
    });
    
    console.log('✅ Festival created successfully:', festival.id);
    
    // Clean up - delete the test festival
    await prisma.event.delete({
      where: { id: festival.id }
    });
    
    console.log('✅ Test festival cleaned up');
    
    return NextResponse.json({
      success: true,
      message: 'Festival creation test passed',
      festival: {
        id: festival.id,
        title: festival.title,
        createdById: festival.createdById
      },
      users: users
    });
    
  } catch (error) {
    console.error('❌ Festival creation test failed:', error);
    return NextResponse.json({
      error: 'Festival creation test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 