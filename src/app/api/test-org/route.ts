import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    console.log('Testing organizations for userId:', userId);
    
    // Get all organizations
    const allOrgs = await prisma.organization.findMany({
      include: {
        users: {
          include: {
            user: true,
          },
        },
      },
    });
    
    console.log('All organizations:', allOrgs);
    
    // Get organizations for specific user
    let userOrgs = [];
    if (userId) {
      userOrgs = await prisma.organization.findMany({
        where: {
          users: {
            some: {
              userId,
            },
          },
        },
        include: {
          users: {
            include: {
              user: true,
            },
          },
        },
      });
    }
    
    console.log('User organizations:', userOrgs);
    
    return NextResponse.json({
      allOrganizations: allOrgs,
      userOrganizations: userOrgs,
    });
  } catch (error) {
    console.error('Error testing organizations:', error);
    return NextResponse.json(
      { error: 'Failed to test organizations' },
      { status: 500 }
    );
  }
} 