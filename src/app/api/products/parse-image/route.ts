export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { uploadDataUrlToSupabase } from '@/lib/uploadToSupabase';
import {
  PRODUCT_EXTRACTION_INSTRUCTION,
  parseProductFromContent,
} from '@/lib/products/manualCapture';

const SUPPORTED_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type SupportedMedia = (typeof SUPPORTED_MEDIA)[number];

/**
 * POST /api/products/parse-image
 * Body: { imageDataUrl: string, url?: string }
 * The screenshot path of guided capture: hosts the screenshot as the product
 * image AND runs Claude vision to auto-fill the fields.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const imageDataUrl: string = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : '';
    const url: string | undefined = typeof body?.url === 'string' ? body.url : undefined;

    const match = imageDataUrl.match(/^data:(.*?);base64,([\s\S]*)$/);
    if (!match) {
      return NextResponse.json(
        { error: 'Upload a screenshot or product image.' },
        { status: 400 },
      );
    }
    const declaredMime = match[1].toLowerCase();
    const base64 = match[2];
    const mediaType: SupportedMedia = (SUPPORTED_MEDIA as readonly string[]).includes(declaredMime)
      ? (declaredMime as SupportedMedia)
      : 'image/png';

    // Host the screenshot first so it can serve as the product image. If storage
    // fails we still try vision — the designer can attach an image separately.
    let hostedUrl: string | null = null;
    try {
      hostedUrl = await uploadDataUrlToSupabase(imageDataUrl);
    } catch (e) {
      console.error('[products/parse-image] upload failed:', e);
    }

    const fields = await parseProductFromContent([
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      {
        type: 'text',
        text: `${PRODUCT_EXTRACTION_INSTRUCTION}

This is a screenshot of a product page${url ? ` from ${url}` : ''}. Extract the product shown.`,
      },
    ]);

    return NextResponse.json({ fields, image: hostedUrl });
  } catch (error) {
    console.error('[products/parse-image] error:', error);
    return NextResponse.json(
      { error: 'Could not read that screenshot. Try another, or enter the details manually.' },
      { status: 500 },
    );
  }
}
