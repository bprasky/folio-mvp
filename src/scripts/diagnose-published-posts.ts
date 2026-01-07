import { prisma } from '@/lib/prisma';

async function diagnosePublishedPosts() {
  console.log('🔍 Diagnosing published posts...\n');

  const posts = await prisma.projectPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      slug: true,
      publishedAt: true,
      expandedBlocks: true,
      provenance: true,
      project: {
        select: {
          title: true,
        },
      },
    },
  });

  console.log(`Found ${posts.length} published posts\n`);

  for (const post of posts) {
    const blocks = post.expandedBlocks as any;
    const interview = (post.provenance as any)?.interview;
    
    const status = {
      hasExpandedBlocks: !!post.expandedBlocks,
      expandedBlocksType: post.expandedBlocks ? typeof post.expandedBlocks : 'null',
      isObject: post.expandedBlocks && typeof post.expandedBlocks === 'object',
      hasLead: !!blocks?.lead,
      hasTitle: !!(blocks?.lead?.title || blocks?.lead?.kicker),
      hasGalleryChapters: Array.isArray(blocks?.galleryChapters) && blocks.galleryChapters.length > 0,
      hasNarrativeBody: blocks?.galleryChapters?.[0]?.body?.length > 0,
      narrativeParagraphs: blocks?.galleryChapters?.[0]?.body?.length || 0,
      hasImages: blocks?.galleryChapters?.[0]?.imageIds?.length > 0,
      imageCount: blocks?.galleryChapters?.[0]?.imageIds?.length || 0,
      interviewAnswers: interview?.payload?.answers?.length || 0,
      interviewFollowups: interview?.payload?.followups?.length || 0,
      generatedAt: interview?.generatedAt || null,
    };

    const isValid = status.hasExpandedBlocks && 
                   status.hasTitle && 
                   status.hasGalleryChapters && 
                   status.hasNarrativeBody &&
                   status.hasImages;

    console.log(`${isValid ? '✅' : '❌'} ${post.project.title}`);
    console.log(`   Slug: ${post.slug}`);
    console.log(`   Published: ${post.publishedAt?.toISOString()}`);
    console.log(`   Status:`, status);
    
    if (!isValid) {
      console.log(`   ⚠️  ISSUES FOUND:`);
      if (!status.hasExpandedBlocks) console.log(`      - No expandedBlocks`);
      if (!status.hasTitle) console.log(`      - No title/kicker`);
      if (!status.hasGalleryChapters) console.log(`      - No gallery chapters`);
      if (!status.hasNarrativeBody) console.log(`      - No narrative body`);
      if (!status.hasImages) console.log(`      - No images`);
    }
    console.log('');
  }

  // Summary
  const validCount = posts.filter(p => {
    const blocks = p.expandedBlocks as any;
    return !!blocks?.lead && !!blocks?.galleryChapters?.[0]?.body?.length;
  }).length;

  console.log(`\n📊 Summary:`);
  console.log(`   Total published: ${posts.length}`);
  console.log(`   Valid content: ${validCount}`);
  console.log(`   Broken/incomplete: ${posts.length - validCount}`);
}

diagnosePublishedPosts()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });



