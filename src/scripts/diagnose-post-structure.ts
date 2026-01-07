import { prisma } from '@/lib/prisma';

async function diagnosePostStructure() {
  console.log('🔍 Detailed structure diagnosis for published posts...\n');

  const posts = await prisma.projectPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
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

  for (const post of posts) {
    console.log(`\n📄 ${post.project.title} (${post.slug})`);
    console.log(`   Published: ${post.publishedAt?.toISOString()}`);
    
    if (!post.expandedBlocks) {
      console.log(`   ❌ expandedBlocks: NULL`);
      continue;
    }

    const blocks = post.expandedBlocks as any;
    
    console.log(`   ✅ expandedBlocks: EXISTS (${typeof blocks})`);
    console.log(`   Keys: ${Object.keys(blocks).join(', ')}`);
    
    // Check lead structure
    if (blocks.lead) {
      console.log(`   📝 lead:`, {
        title: blocks.lead.title || 'MISSING',
        kicker: blocks.lead.kicker || 'MISSING',
        deck: blocks.lead.deck || 'MISSING',
        keys: Object.keys(blocks.lead),
      });
    } else {
      console.log(`   ❌ lead: MISSING`);
    }
    
    // Check gallery chapters
    if (Array.isArray(blocks.galleryChapters)) {
      console.log(`   🖼️  galleryChapters: ${blocks.galleryChapters.length} chapter(s)`);
      if (blocks.galleryChapters.length > 0) {
        const first = blocks.galleryChapters[0];
        console.log(`      Chapter 0:`, {
          title: first.title || 'MISSING',
          body: Array.isArray(first.body) 
            ? `${first.body.length} paragraph(s)` 
            : typeof first.body,
          imageIds: Array.isArray(first.imageIds)
            ? `${first.imageIds.length} image(s)`
            : typeof first.imageIds,
          keys: Object.keys(first),
        });
      }
    } else {
      console.log(`   ❌ galleryChapters: MISSING or not array`);
    }
    
    // Check other fields
    if (blocks.pullQuotes) {
      console.log(`   💬 pullQuotes: ${Array.isArray(blocks.pullQuotes) ? blocks.pullQuotes.length : 'not array'}`);
    }
    if (blocks.credits) {
      console.log(`   👤 credits: ${Array.isArray(blocks.credits) ? blocks.credits.length : 'not array'}`);
    }
    if (blocks.materialsLedger) {
      console.log(`   📦 materialsLedger: EXISTS`);
    }
    
    // Check provenance
    const interview = (post.provenance as any)?.interview;
    if (interview) {
      console.log(`   📋 Interview data:`, {
        hasAnswers: !!(interview.payload?.answers?.length),
        answerCount: interview.payload?.answers?.length || 0,
        hasFollowups: !!(interview.payload?.followups?.length),
        followupCount: interview.payload?.followups?.length || 0,
        generatedAt: interview.generatedAt 
          ? new Date(interview.generatedAt).toISOString() 
          : 'MISSING',
        status: interview.status?.phase || 'unknown',
      });
    } else {
      console.log(`   ❌ Interview provenance: MISSING`);
    }
  }

  // Summary
  const nullCount = posts.filter(p => !p.expandedBlocks).length;
  const hasTitleOrKicker = posts.filter(p => {
    const blocks = p.expandedBlocks as any;
    return !!(blocks?.lead?.title || blocks?.lead?.kicker);
  }).length;
  const hasNarrative = posts.filter(p => {
    const blocks = p.expandedBlocks as any;
    return !!(blocks?.galleryChapters?.[0]?.body?.length);
  }).length;
  const hasImages = posts.filter(p => {
    const blocks = p.expandedBlocks as any;
    return !!(blocks?.galleryChapters?.[0]?.imageIds?.length);
  }).length;

  console.log(`\n\n📊 Summary:`);
  console.log(`   Total published: ${posts.length}`);
  console.log(`   NULL expandedBlocks: ${nullCount}`);
  console.log(`   Has title/kicker: ${hasTitleOrKicker}`);
  console.log(`   Has narrative body: ${hasNarrative}`);
  console.log(`   Has images: ${hasImages}`);
  console.log(`   Fully valid: ${posts.filter(p => {
    const blocks = p.expandedBlocks as any;
    return !!(blocks?.lead?.title || blocks?.lead?.kicker) &&
           !!(blocks?.galleryChapters?.[0]?.body?.length) &&
           !!(blocks?.galleryChapters?.[0]?.imageIds?.length);
  }).length}`);
}

diagnosePostStructure()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });



