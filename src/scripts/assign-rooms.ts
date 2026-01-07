import { prisma } from '@/lib/prisma';

async function assignRooms() {
  const projectId = process.argv[2];
  
  if (!projectId) {
    console.error('Usage: npx tsx src/scripts/assign-rooms.ts <projectId>');
    process.exit(1);
  }
  
  // Get all images
  const images = await prisma.projectImage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, room: true, url: true }
  });

  console.log(`Found ${images.length} images\n`);

  // Room detection keywords
  const roomKeywords: Record<string, string[]> = {
    'Kitchen': ['kitchen', 'bar', 'dining'],
    'Living Room': ['living', 'lounge', 'family room', 'great room'],
    'Bedroom': ['bedroom', 'master', 'guest room', 'suite'],
    'Bathroom': ['bathroom', 'bath', 'powder', 'spa'],
    'Entryway': ['entry', 'foyer', 'hall', 'vestibule'],
    'Office': ['office', 'study', 'workspace', 'library'],
    'Outdoor': ['outdoor', 'patio', 'terrace', 'garden', 'deck'],
  };

  const updates: Array<{ id: string; room: string; name: string }> = [];

  for (const img of images) {
    if (img.room) {
      console.log(`✅ ${img.name || img.id.slice(0, 8)} → ${img.room} (already set)`);
      continue;
    }

    // Try to detect room from name or URL
    const searchText = `${img.name || ''} ${img.url || ''}`.toLowerCase();
    let detectedRoom = 'General';

    for (const [room, keywords] of Object.entries(roomKeywords)) {
      if (keywords.some(kw => searchText.includes(kw))) {
        detectedRoom = room;
        break;
      }
    }

    updates.push({ id: img.id, room: detectedRoom, name: img.name || img.id.slice(0, 8) });
    console.log(`🔧 ${img.name || img.id.slice(0, 8)} → ${detectedRoom} (auto-detected)`);
  }

  if (updates.length > 0) {
    console.log(`\n📝 Updating ${updates.length} images...`);
    
    for (const { id, room } of updates) {
      await prisma.projectImage.update({
        where: { id },
        data: { room }
      });
    }

    console.log('✅ Room assignments complete!');
  } else {
    console.log('✅ All images already have room assignments');
  }
}

assignRooms()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

