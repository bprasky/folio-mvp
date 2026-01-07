import { prisma } from '@/lib/prisma';

async function checkRoomData() {
  const projectId = process.argv[2];
  
  if (!projectId) {
    console.error('Usage: npx tsx src/scripts/check-room-data.ts <projectId>');
    process.exit(1);
  }
  
  console.log('🔍 Checking room data for project...\n');
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      images: {
        include: {
          tags: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  vendor: {
                    select: { name: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!project) {
    console.error('❌ Project not found');
    process.exit(1);
  }

  console.log(`📋 Project: ${project.title}`);
  console.log(`📸 Total images: ${project.images.length}\n`);

  // Group by room
  const byRoom: Record<string, any[]> = {};
  for (const img of project.images) {
    const room = img.room || 'UNASSIGNED';
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push(img);
  }

  console.log('🏠 Rooms found:');
  for (const [room, images] of Object.entries(byRoom)) {
    const totalTags = images.reduce((sum, img) => sum + img.tags.length, 0);
    const products = new Set(images.flatMap(img => img.tags.map(t => t.product.name)));
    
    console.log(`\n  ${room === 'UNASSIGNED' ? '⚠️  ' : '✅ '} ${room}`);
    console.log(`     Images: ${images.length}`);
    console.log(`     Product tags: ${totalTags}`);
    console.log(`     Unique products: ${products.size}`);
    
    if (products.size > 0) {
      console.log(`     Products: ${Array.from(products).slice(0, 3).join(', ')}${products.size > 3 ? '...' : ''}`);
    }
  }

  if (byRoom['UNASSIGNED']) {
    console.log('\n⚠️  WARNING: Some images have no room assignment!');
    console.log('   Assign rooms to images for better article organization.');
  }
  
  console.log('\n✅ Room check complete!');
}

checkRoomData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

