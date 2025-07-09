import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // For now, return mock data until we can fix the Prisma client issues
    const mockUsers = [
      {
        id: '1',
        email: 'designer@example.com',
        name: 'John Designer',
        profileType: 'designer',
        createdAt: new Date().toISOString(),
        onboardingCompleted: false,
        eventAttribution: 'nycxdesign-2025',
        websiteUrl: 'https://www.studiolife.com',
        lastLogin: new Date().toISOString(),
        status: 'pending' as const,
        importStatus: {
          status: 'failed' as const,
          errorMessage: 'Browserless endpoint deprecated',
          importDate: new Date().toISOString(),
          retryCount: 0
        }
      },
      {
        id: '2',
        email: 'vendor@example.com',
        name: 'Jane Vendor',
        profileType: 'vendor',
        createdAt: new Date().toISOString(),
        onboardingCompleted: true,
        eventAttribution: null,
        websiteUrl: null,
        lastLogin: new Date().toISOString(),
        status: 'active' as const,
        importStatus: null
      }
    ];

    return NextResponse.json({
      success: true,
      users: mockUsers
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
} 