import { prisma } from '@/lib/prisma';

async function findProjectId() {
  const slug = process.argv[2] || 'lucas-house-VRBWUP';
  
  console.log(`🔍 Searching for project with slug: ${slug}\n`);
  
  const post = await prisma.projectPost.findFirst({
    where: { 
      slug: {
        contains: slug,
        mode: 'insensitive'
      }
    },
    select: { 
      projectId: true, 
      slug: true,
      project: { 
        select: { 
          id: true,
          title: true 
        } 
      } 
    }
  });
  
  if (post) {
    console.log('✅ Found project:');
    console.log(`   Project ID: ${post.projectId}`);
    console.log(`   Project Title: ${post.project.title}`);
    console.log(`   Post Slug: ${post.slug}`);
    console.log(`\n📋 Use this project ID for testing:`);
    console.log(`   ${post.projectId}`);
  } else {
    console.log('❌ Project not found with that slug');
    console.log('\n🔍 Searching for projects with "lucas" in title...\n');
    
    const projects = await prisma.project.findMany({
      where: {
        title: {
          contains: 'lucas',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        title: true,
        post: {
          select: {
            slug: true
          }
        }
      },
      take: 5
    });
    
    if (projects.length > 0) {
      console.log('Found projects:');
      for (const proj of projects) {
        console.log(`\n   Project ID: ${proj.id}`);
        console.log(`   Title: ${proj.title}`);
        console.log(`   Slug: ${proj.post?.slug || 'N/A'}`);
      }
    } else {
      console.log('❌ No projects found');
    }
  }
}

findProjectId()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


