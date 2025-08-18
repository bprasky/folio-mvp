// scripts/create-designer.mjs
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY; // NEVER commit this
const prisma = new PrismaClient();

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const email = 'designer.demo@folioad.com';
const password = 'FolioDemo!2025';
const displayName = 'Folio Demo Designer';

async function main() {
  console.log('Creating demo designer user...');
  
  // 1) Find or create Supabase auth user
  const { data: existingUser, error: getUserError } = await supabase.auth.admin.listUsers();
  if (getUserError) throw getUserError;
  
  const existingUserData = existingUser.users.find(user => user.email === email);
  let userId;
  
  if (existingUserData) {
    userId = existingUserData.id;
    console.log('Found existing Supabase user:', userId);
  } else {
    const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'designer', displayName }
    });
    if (createError) throw createError;
    userId = createdUser.user.id;
    console.log('Created new Supabase user:', userId);
  }

  // 2) Upsert app-side profile (using the User model from your schema)
  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email,
      name: displayName,
      role: 'DESIGNER' // Prisma enum Role.DESIGNER
    },
    update: {
      email,
      name: displayName,
      role: 'DESIGNER'
    }
  });

  console.log('\n✅ Created/verified Designer login:');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('Role: DESIGNER');
  console.log('\nYou can now use these credentials to log in to the application.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  }); 