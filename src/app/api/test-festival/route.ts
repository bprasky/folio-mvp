export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    console.log('🧪 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Test if we can query users
    const userCount = await prisma.user.count();
    console.log('✅ User count:', userCount);
    
    // Test if we can create a simple festival
    const testFestival = await prisma.event.create({
      data: {
        title: 'Test Festival',
        description: 'Test Description',
        location: 'Test Location',
        startDate: new Date('2025-12-20T10:00:00Z'),
        endDate: new Date('2025-12-22T18:00:00Z'),
        type: 'festival',
        isPublic: true,
        isApproved: true,
        requiresApproval: false,
        createdById: 'test-user-id'
      }
    });
    
    console.log('✅ Test festival created:', testFestival.id);
    
    // Clean up - delete the test festival
    await prisma.event.delete({
      where: { id: testFestival.id }
    });
    
    console.log('✅ Test festival cleaned up');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database and festival creation working!',
      userCount,
      testFestivalId: testFestival.id
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 