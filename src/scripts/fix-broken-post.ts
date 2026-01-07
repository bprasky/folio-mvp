import { prisma } from '@/lib/prisma';

/**
 * Fix broken published post by regenerating expandedBlocks
 * 
 * Usage: npx tsx src/scripts/fix-broken-post.ts <slug>
 * Example: npx tsx src/scripts/fix-broken-post.ts lucas-house-566ba775
 */

async function fixBrokenPost(slug: string) {
  console.log(`🔧 Fixing broken post: ${slug}\n`);

  // Find the post
  const post = await prisma.projectPost.findUnique({
    where: { slug },
    include: {
      project: {
        include: {
          images: {
            include: {
              tags: {
                include: {
                  product: {
                    include: {
                      vendor: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!post) {
    console.error(`❌ Post not found: ${slug}`);
    process.exit(1);
  }

  if (post.status !== 'PUBLISHED') {
    console.log(`⚠️  Post is not PUBLISHED (status: ${post.status})`);
    console.log(`   This script is for fixing published posts.`);
    process.exit(1);
  }

  console.log(`📄 Post: ${post.project.title}`);
  console.log(`   Project ID: ${post.projectId}`);
  console.log(`   Status: ${post.status}`);
  console.log(`   Published: ${post.publishedAt?.toISOString()}`);
  console.log(`   Has expandedBlocks: ${!!post.expandedBlocks}`);
  console.log(`   Has images: ${post.project.images.length}`);
  console.log(`   Has tags: ${post.project.images.reduce((sum, img) => sum + img.tags.length, 0)}`);

  // Check provenance
  const provenance = (post.provenance as any) || {};
  const interview = provenance.interview || {};
  const hasInterviewData = !!(interview.payload?.answers?.length);

  console.log(`\n📋 Interview Data:`);
  console.log(`   Has interview answers: ${hasInterviewData}`);
  if (hasInterviewData) {
    console.log(`   Answer count: ${interview.payload.answers.length}`);
    console.log(`   Followup count: ${interview.payload.followups?.length || 0}`);
  } else {
    console.log(`   ⚠️  No interview data found in provenance`);
    console.log(`   This post was likely published before the interview workflow was completed.`);
  }

  if (!hasInterviewData) {
    console.log(`\n❌ Cannot regenerate: No interview data found.`);
    console.log(`\n💡 Options:`);
    console.log(`   1. Unpublish this post (set status to DRAFT)`);
    console.log(`   2. Complete the interview workflow for this project`);
    console.log(`   3. Manually create expandedBlocks structure`);
    console.log(`\nTo unpublish:`);
    console.log(`   UPDATE project_posts SET status = 'DRAFT' WHERE slug = '${slug}';`);
    process.exit(1);
  }

  console.log(`\n✅ Interview data found. You can regenerate this post by:`);
  console.log(`   1. Navigate to: /designer/projects/${post.projectId}/preview`);
  console.log(`   2. Click "Edit Answers / Regenerate"`);
  console.log(`   3. Click "Generate AI Draft"`);
  console.log(`   4. Once generated, the post will have content`);
  console.log(`\nOr use the API directly:`);
  console.log(`   POST /api/posting/project/${post.projectId}/interview/generate`);
  console.log(`   Body: { "force": true }`);
}

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npx tsx src/scripts/fix-broken-post.ts <slug>');
  console.error('Example: npx tsx src/scripts/fix-broken-post.ts lucas-house-566ba775');
  process.exit(1);
}

fixBrokenPost(slug)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });



