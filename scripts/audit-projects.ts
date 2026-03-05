import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function audit() {
  // Get all users who own at least 1 project, with their projects and post status
  const users = await prisma.user.findMany({
    where: {
      ownedProjects: {
        some: {},
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      ownedProjects: {
        select: {
          id: true,
          title: true,
          status: true,
          isPublic: true,
          post: {
            select: {
              id: true,
              status: true,
              publishedAt: true,
            },
          },
          participants: {
            select: {
              id: true,
              userId: true,
              role: true,
              side: true,
            },
          },
        },
      },
    },
  });

  console.log('\n=== PROJECT OWNERSHIP AUDIT ===\n');

  for (const user of users) {
    const totalProjects = user.ownedProjects.length;
    const publishedPosts = user.ownedProjects.filter(
      (p) => p.post?.status === 'PUBLISHED'
    ).length;
    const projectTitles = user.ownedProjects.map(
      (p) => `"${p.title || '(untitled)'}" [${p.status}]${p.post ? ` (post: ${p.post.status})` : ' (no post)'}`
    );

    console.log(`User: ${user.name || '(no name)'}`);
    console.log(`  ID:    ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  # Projects: ${totalProjects}`);
    console.log(`  # Published Posts: ${publishedPosts}`);
    console.log(`  Projects:`);
    for (const title of projectTitles) {
      console.log(`    - ${title}`);
    }

    // Show participant records for this user's projects
    const participantInfo = user.ownedProjects.flatMap((p) =>
      p.participants.map((part) => ({
        projectTitle: p.title,
        ...part,
      }))
    );
    if (participantInfo.length > 0) {
      console.log(`  Participants on their projects:`);
      for (const part of participantInfo) {
        console.log(`    - Project "${part.projectTitle}": userId=${part.userId}, role=${part.role}, side=${part.side}`);
      }
    }

    console.log('');
  }

  // Also check if there are users with "BP Design" or similar in name
  console.log('\n=== SEARCHING FOR "BP Design" or similar ===');
  const bpUsers = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: 'BP', mode: 'insensitive' } },
        { name: { contains: 'Design', mode: 'insensitive' } },
        { email: { contains: 'bp', mode: 'insensitive' } },
        { email: { contains: 'prasky', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      _count: { select: { ownedProjects: true } },
    },
  });

  for (const u of bpUsers) {
    console.log(`  ${u.name} | ${u.email} | ${u.id} | ${u._count.ownedProjects} projects`);
  }

  // Also check Supabase auth.users if accessible
  console.log('\n=== CHECKING auth.users (Supabase) ===');
  try {
    const authUsers: any[] = await prisma.$queryRaw`
      SELECT id, email, raw_user_meta_data->>'name' as name, created_at
      FROM auth.users
      ORDER BY created_at
    `;
    for (const u of authUsers) {
      console.log(`  ${u.name || '(no name)'} | ${u.email} | ${u.id} | created: ${u.created_at}`);
    }
  } catch (e: any) {
    console.log(`  Could not query auth.users: ${e.message}`);
  }

  await prisma.$disconnect();
}

audit().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
