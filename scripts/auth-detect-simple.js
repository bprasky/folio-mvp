const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function detectAuth() {
  try {
    console.log('🔍 Detecting authentication setup...\n');

    // Check if DATABASE_URL is available
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.log('❌ DATABASE_URL not found in environment variables');
      return {
        prismaUsers: 0,
        hasAdmin: false,
        usingSupabaseAuth: false,
        databaseConnected: false,
        error: 'DATABASE_URL not found in environment variables',
      };
    }

    console.log(`🔌 Database URL: ${databaseUrl.substring(0, 20)}...`);
    console.log('🔌 Testing database connection...');

    // Test database connection first
    try {
      await prisma.$connect();
      console.log('✅ Database connection successful');
    } catch (connectionError) {
      console.log('❌ Database connection failed');
      console.log('   This could be due to:');
      console.log('   - Database server is down');
      console.log('   - Invalid DATABASE_URL in .env');
      console.log('   - Network connectivity issues');
      console.log('   - Supabase service interruption');
      
      const errorSummary = {
        prismaUsers: 0,
        hasAdmin: false,
        usingSupabaseAuth: false,
        databaseConnected: false,
        databaseUrl: databaseUrl.substring(0, 20) + '...',
        error: connectionError.message || 'Database connection failed',
      };

      console.log('\n📋 Connection Error Summary:');
      console.log(JSON.stringify(errorSummary, null, 2));

      return errorSummary;
    }

    // 1. Check Prisma User table
    console.log('\n📊 Checking Prisma User table...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        password: true,
      },
    });

    const prismaUsers = users.length;
    const adminUsers = users.filter(user => user.role === 'ADMIN');
    const hasAdmin = adminUsers.length > 0;
    const adminEmails = adminUsers.map(user => user.email).filter(email => email !== null);

    console.log(`✅ Found ${prismaUsers} users in Prisma User table`);
    console.log(`✅ Admin users: ${hasAdmin ? adminEmails.join(', ') : 'None'}`);

    // 2. Check for Supabase Auth schema
    console.log('\n🔐 Checking Supabase Auth schema...');
    let usingSupabaseAuth = false;

    try {
      // Try to query Supabase auth.users table
      const supabaseAuthResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'auth' 
        AND table_name = 'users'
      `;

      if (supabaseAuthResult && Array.isArray(supabaseAuthResult) && supabaseAuthResult[0]) {
        const count = supabaseAuthResult[0].count;
        usingSupabaseAuth = count > 0;
        console.log(`✅ Supabase auth.users table: ${usingSupabaseAuth ? 'EXISTS' : 'NOT FOUND'}`);
      }
    } catch (error) {
      console.log('❌ Could not check Supabase auth schema (this is normal if not using Supabase Auth)');
    }

    // 3. Check for password hashes
    const usersWithPasswords = users.filter(user => user.password);
    console.log(`\n🔑 Users with passwords: ${usersWithPasswords.length}/${prismaUsers}`);

    const summary = {
      prismaUsers,
      hasAdmin,
      usingSupabaseAuth,
      adminEmails: hasAdmin ? adminEmails : undefined,
      databaseConnected: true,
      databaseUrl: databaseUrl.substring(0, 20) + '...',
    };

    console.log('\n📋 Summary:');
    console.log(JSON.stringify(summary, null, 2));

    return summary;

  } catch (error) {
    console.error('❌ Error detecting auth setup:', error);
    
    const errorSummary = {
      prismaUsers: 0,
      hasAdmin: false,
      usingSupabaseAuth: false,
      databaseConnected: false,
      error: error.message || 'Unknown error',
    };

    console.log('\n📋 Error Summary:');
    console.log(JSON.stringify(errorSummary, null, 2));

    return errorSummary;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the detection
detectAuth()
  .then((summary) => {
    process.exit(summary.error ? 1 : 0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }); 