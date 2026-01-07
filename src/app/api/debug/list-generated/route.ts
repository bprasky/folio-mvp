import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId")!;
    const roomId = searchParams.get("roomId")!;
    const bucket = process.env.SB_BUCKET_NAME || "event-images";

    if (!projectId || !roomId) {
      return NextResponse.json({ error: "Missing projectId or roomId" }, { status: 400 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // Check both old and new path structures
    const prefixes = [
      `project-assets/${projectId}/${roomId}/generated/`, // Old path
      `${projectId}/${roomId}/generated/` // New path
    ];
    
    let allFiles: any[] = [];
    
    for (const prefix of prefixes) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { 
        limit: 100, 
        offset: 0 
      });
      
      if (!error && data) {
        allFiles = allFiles.concat(data.map(obj => ({ ...obj, prefix })));
      }
    }

    const files = allFiles.map(obj => ({
      name: obj.name,
      size: obj.metadata?.size,
      lastModified: obj.updated_at,
      prefix: obj.prefix,
      publicUrl: supabase.storage.from(bucket).getPublicUrl(obj.prefix + obj.name).data.publicUrl
    }));

    return NextResponse.json({ 
      ok: true, 
      bucket, 
      prefixes: prefixes,
      fileCount: files.length,
      files 
    });
  } catch (error: any) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
