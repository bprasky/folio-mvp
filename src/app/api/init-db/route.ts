import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  try {
    console.log('🔌 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    console.log('📋 Creating database tables...');
    
    // Create tables using Prisma
    const { execSync } = require('child_process');
    execSync('npx prisma db push', { stdio: 'inherit' });
    
    console.log('✅ Database tables created successfully');

    // Create a test admin user
    console.log('👤 Creating test admin user...');
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@test.com' },
      update: {},
      create: {
        email: 'admin@test.com',
        name: 'Admin User',
        profileType: 'admin',
        location: 'New York, NY'
      }
    });
    console.log('✅ Test admin user created:', adminUser.id);

    // Create a test vendor user
    console.log('🏢 Creating test vendor user...');
    const vendorUser = await prisma.user.upsert({
      where: { email: 'vendor@test.com' },
      update: {},
      create: {
        email: 'vendor@test.com',
        name: 'Test Vendor',
        profileType: 'vendor',
        companyName: 'Test Company',
        location: 'Los Angeles, CA'
      }
    });
    console.log('✅ Test vendor user created:', vendorUser.id);

    // Create a test designer user
    console.log('🎨 Creating test designer user...');
    const designerUser = await prisma.user.upsert({
      where: { email: 'designer@test.com' },
      update: {},
      create: {
        email: 'designer@test.com',
        name: 'Test Designer',
        profileType: 'designer',
        specialties: ['Interior Design', 'Furniture'],
        location: 'Miami, FL'
      }
    });
    console.log('✅ Test designer user created:', designerUser.id);

    // Create a sample festival
    console.log('🎪 Creating sample festival...');
    const sampleFestival = await prisma.event.create({
      data: {
        title: 'Design Week 2024',
        description: 'A week-long celebration of design innovation and creativity featuring top designers, vendors, and industry leaders.',
        location: 'New York, NY',
        startDate: new Date('2024-06-15T09:00:00Z'),
        endDate: new Date('2024-06-22T18:00:00Z'),
        type: 'festival',
        isPublic: true,
        isApproved: true,
        requiresApproval: false,
        createdById: adminUser.id
      }
    });
    console.log('✅ Sample festival created:', sampleFestival.id);

    // Create a sample event
    console.log('📅 Creating sample event...');
    const sampleEvent = await prisma.event.create({
      data: {
        title: 'Sustainable Design Panel',
        description: 'Join industry experts for a discussion on sustainable design practices and eco-friendly materials.',
        location: 'New York Convention Center',
        startDate: new Date('2024-06-16T14:00:00Z'),
        endDate: new Date('2024-06-16T16:00:00Z'),
        type: 'panel',
        isPublic: true,
        isApproved: true,
        requiresApproval: false,
        createdById: adminUser.id,
        parentFestivalId: sampleFestival.id
      }
    });
    console.log('✅ Sample event created:', sampleEvent.id);

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully!',
      data: {
        adminUser: adminUser.id,
        vendorUser: vendorUser.id,
        designerUser: designerUser.id,
        sampleFestival: sampleFestival.id,
        sampleEvent: sampleEvent.id
      }
    });

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize database', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET() {
  try {
    await prisma.$connect();
    
    // Test if tables exist by trying to count users
    const userCount = await prisma.user.count();
    
    return NextResponse.json({
      status: 'connected',
      tablesExist: true,
      userCount
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      tablesExist: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
} 