import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { scrapeDesignerProfile } from '@lib/scraper/browserless';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, password, website } = await request.json();

    console.log('Designer signup request:', { email, website });

    // Validate required fields
    if (!email || !password || !website) {
      return NextResponse.json(
        { error: 'Email, password, and website are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Scrape profile info from website
    const scrapedData = await scrapeDesignerProfile(website);

    // Create user with complete profile data
    const user = await prisma.user.create({
      data: {
        email,
        name: scrapedData.companyName || 'Designer',
        profileType: 'designer',
        website,
        bio: scrapedData.about || null,
        profileImage: scrapedData.logo || null,
        location: null,
        specialties: [],
        instagram: scrapedData.contactInfo?.socialMedia?.instagram || null,
        linkedin: scrapedData.contactInfo?.socialMedia?.linkedin || null,
        followers: 0,
        views: 0
      }
    });

    // Create designer profile with team info
    await prisma.designerProfile.create({
      data: {
        userId: user.id,
        about: scrapedData.about || null,
        logo: scrapedData.logo || null,
        team: scrapedData.team ? JSON.stringify(scrapedData.team) : null,
        specialties: []
      }
    });

    console.log('Signup completed successfully for user:', user.id);

    return NextResponse.json({
      userId: user.id,
      message: 'Designer account created successfully'
    });

  } catch (error) {
    console.error('Designer signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create designer account' },
      { status: 500 }
    );
  }
} 