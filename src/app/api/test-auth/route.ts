import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing database connection via API...');

    // Test connection
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Get user count
    const userCount = await prisma.user.count();
    console.log(`✅ Found ${userCount} users`);

    // Get admin users
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true, role: true },
    });

    // Check for Supabase auth schema
    let usingSupabaseAuth = false;
    try {
      const supabaseAuthResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'auth' 
        AND table_name = 'users'
      `;
      
      if (supabaseAuthResult && Array.isArray(supabaseAuthResult) && supabaseAuthResult[0]) {
        const count = (supabaseAuthResult[0] as any).count;
        usingSupabaseAuth = count > 0;
      }
    } catch (error) {
      console.log('Could not check Supabase auth schema');
    }

    const result = {
      prismaUsers: userCount,
      hasAdmin: adminUsers.length > 0,
      usingSupabaseAuth,
      adminEmails: adminUsers.map(u => u.email).filter(Boolean),
      databaseConnected: true,
      timestamp: new Date().toISOString(),
    };

    console.log('📋 Auth Test Result:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    
    const errorResult = {
      prismaUsers: 0,
      hasAdmin: false,
      usingSupabaseAuth: false,
      databaseConnected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResult, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 