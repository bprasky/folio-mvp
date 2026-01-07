import { prisma } from '@/lib/prisma';

async function clearArticle() {
  const projectId = process.argv[2];
  
  if (!projectId) {
    console.error('Usage: npx tsx src/scripts/clear-article.ts <projectId>');
    process.exit(1);
  }
  
  console.log(`🗑️  Clearing article for project: ${projectId}\n`);
  
  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: { id: true, project: { select: { title: true } } }
  });
  
  if (!post) {
    console.error('❌ Post not found');
    process.exit(1);
  }
  
  console.log(`Project: ${post.project.title}`);
  console.log(`Post ID: ${post.id}\n`);
  
  await prisma.projectPost.update({
    where: { projectId },
    data: { 
      expandedBlocks: null,
      updatedAt: new Date()
    }
  });
  
  console.log('✅ Article cleared - ready for regeneration');
  console.log('   Now go to the project and click "Generate Draft"');
}

clearArticle()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


