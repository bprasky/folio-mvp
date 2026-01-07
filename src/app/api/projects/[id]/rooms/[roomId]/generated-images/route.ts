import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      console.warn("[generated-images][401] No session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: projectId, roomId } = params;

    const access = await assertProjectAccess({ projectId, userId, role: session.user.role });
    if (!access.ok) {
      console.warn("[generated-images][access]", access);
      return NextResponse.json({ error: access.reason }, { status: access.status });
    }

    // Fetch generated images for the room
    const images = await prisma.projectImage.findMany({
      where: {
        projectId,
        room: roomId,
        // Filter for generated images by checking if name contains metadata JSON
        name: {
          contains: '"type":"GENERATED"'
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse metadata from the name field (temporary solution)
    const parsedImages = images.map(img => {
      let metadata = null;
      try {
        metadata = JSON.parse(img.name || '{}');
      } catch (e) {
        // If parsing fails, it's not a generated image
        return null;
      }

      if (metadata.type !== 'GENERATED') {
        return null;
      }

      return {
        id: img.id,
        url: img.url,
        width: metadata.width || 1024,
        height: metadata.height || 1024,
        name: `Generated Image - ${new Date(img.createdAt).toLocaleDateString()}`,
        createdAt: img.createdAt.toISOString(),
        provider: metadata.provider || "unknown",
        metadata: { context: metadata.contextJSON ?? null }
      };
    }).filter(Boolean);

    // Also check storage for any orphaned images (images that exist in storage but not in DB)
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const bucket = "event-images";
      
      // Check the old path structure where real images might be
      const prefix = `project-assets/${projectId}/${roomId}/generated/`;
      const { data: storageFiles } = await supabase.storage.from(bucket).list(prefix, { limit: 100 });
      
      if (storageFiles && storageFiles.length > 0) {
        console.log(`Found ${storageFiles.length} images in storage for ${projectId}/${roomId}`);
        
        // Add storage images that aren't already in the database
        for (const file of storageFiles) {
          const publicUrl = supabase.storage.from(bucket).getPublicUrl(prefix + file.name).data.publicUrl;
          
          // Check if this URL is already in our parsed images
          const exists = parsedImages.some(img => img.url === publicUrl);
          
          if (!exists) {
            console.log(`Adding orphaned storage image: ${file.name}`);
            parsedImages.push({
              id: `storage-${file.name}`,
              url: publicUrl,
              width: 1024,
              height: 1024,
              name: `Generated Image - ${new Date(file.updated_at || Date.now()).toLocaleDateString()}`,
              createdAt: new Date(file.updated_at || Date.now()).toISOString(),
              provider: "openai", // Assume OpenAI since these are the real images
              metadata: { context: { roomName: "Living Room" } }
            });
          }
        }
      }
    } catch (storageError) {
      console.error('Error checking storage:', storageError);
      // Continue without storage images
    }

    return NextResponse.json({ ok: true, assets: parsedImages });
  } catch (err) {
    console.error("[generated-images][500]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
