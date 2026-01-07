import { prisma } from '@/lib/prisma';

async function inspectContent() {
  const projectId = process.argv[2];
  
  if (!projectId) {
    console.error('Usage: npx tsx src/scripts/inspect-generated-content.ts <projectId>');
    process.exit(1);
  }
  
  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: {
      id: true,
      expandedBlocks: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          title: true,
          images: {
            select: { id: true, room: true, name: true }
          }
        }
      }
    }
  });

  if (!post) {
    console.error('❌ Post not found');
    process.exit(1);
  }

  const blocks = post.expandedBlocks as any;
  
  if (!blocks) {
    console.error('❌ No expandedBlocks found - article not generated yet');
    process.exit(1);
  }
  
  console.log('\n📖 Generated Article Structure:\n');
  console.log(`Project: ${post.project.title}`);
  console.log(`Last updated: ${post.updatedAt.toISOString()}\n`);
  
  console.log('Lead:');
  console.log(`  Kicker: ${blocks.lead?.kicker || blocks.lead?.title || 'N/A'}`);
  console.log(`  Deck: ${blocks.lead?.deck?.substring(0, 100)}...`);
  
  console.log('\nGallery Chapters:');
  for (const [idx, chapter] of (blocks.galleryChapters || []).entries()) {
    console.log(`\n  Chapter ${idx + 1}: ${chapter.title || 'Untitled'}`);
    console.log(`    Paragraphs: ${chapter.body?.length || 0}`);
    console.log(`    Images: ${chapter.imageIds?.length || 0}`);
    
    if (chapter.body?.[0]) {
      console.log(`    First paragraph: ${chapter.body[0].substring(0, 120)}...`);
    }
    
    // Check which rooms these images belong to
    const imageRooms = new Set(
      chapter.imageIds?.map((id: string) => {
        const img = post.project.images.find(i => i.id === id);
        return img?.room || 'Unknown';
      }) || []
    );
    console.log(`    Rooms represented: ${Array.from(imageRooms).join(', ')}`);
  }
  
  console.log('\nPull Quotes:');
  for (const quote of (blocks.pullQuotes || [])) {
    console.log(`  - "${quote.substring(0, 100)}..."`);
  }
  
  console.log('\nMaterials Ledger:');
  const materials = blocks.materialsLedger?.items || [];
  console.log(`  Total products: ${materials.length}`);
  for (const item of materials.slice(0, 5)) {
    console.log(`  - ${item.name} ${item.note ? `(${item.note})` : ''}`);
  }
  if (materials.length > 5) {
    console.log(`  ... and ${materials.length - 5} more`);
  }
  
  // Room organization analysis
  console.log('\n🏠 Room Organization Analysis:');
  const roomChapterMap: Record<string, number> = {};
  for (const chapter of (blocks.galleryChapters || [])) {
    const rooms = new Set(
      chapter.imageIds?.map((id: string) => {
        const img = post.project.images.find(i => i.id === id);
        return img?.room || 'Unknown';
      }) || []
    );
    rooms.forEach(room => {
      roomChapterMap[room] = (roomChapterMap[room] || 0) + 1;
    });
  }
  console.log('  Chapters per room:');
  for (const [room, count] of Object.entries(roomChapterMap)) {
    console.log(`    ${room}: ${count} chapter(s)`);
  }
  
  console.log('\n✅ Inspection complete!');
}

inspectContent()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

