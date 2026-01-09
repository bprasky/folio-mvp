export const dynamic = 'force-dynamic';

// src/app/api/feed/route.ts

import { NextResponse } from "next/server";

import { getPublishedProjectPosts } from "@/lib/feed/getPublishedProjectPosts";

export async function GET() {
  const posts = await getPublishedProjectPosts({ take: 8 });
  return NextResponse.json({ posts });
}


