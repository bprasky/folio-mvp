import { NextResponse } from 'next/server';
import { PrismaClient, EventType } from '@prisma/client';
import { uploadDataUrlToSupabase, buildObjectPath } from '@/lib/uploadToSupabase';
import { time } from '@/lib/telemetry';
import { requireAdmin } from '@/lib/requireAdmin';
import { rateLimit } from '@/lib/rateLimit';
import { EventInput } from '@/lib/validators';

// helper to normalize empty strings to undefined
const opt = (v: unknown) => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length ? s : undefined;
};

async function parseEventRequest(req: Request) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await req.json();
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    const title = form.get('title')?.toString() ?? form.get('name')?.toString() ?? '';
    const description = form.get('description')?.toString() ?? '';
    const location = form.get('location')?.toString() ?? '';
    const startDate = form.get('startDate')?.toString() ?? '';
    const endDate = form.get('endDate')?.toString() ?? '';
    const eventType = form.get('eventType')?.toString() ?? 'OTHER';
    const parentFestivalId = form.get('parentFestivalId')?.toString() ?? null;
    const imageDataUrl = opt(form.get('imageDataUrl')?.toString() ?? '');
    const imageUrl = opt(form.get('imageUrl')?.toString() ?? '');
    let imageFile: File | undefined;
    const f = (form.get('image') ?? form.get('file') ?? form.get('photo'));
    if (f instanceof File) imageFile = f;
    return { title, description, location, startDate, endDate, eventType, parentFestivalId, imageDataUrl, imageUrl, imageFile };
  }
  try { return await req.json(); }
  catch { throw new Error(`Unsupported Content-Type: ${ct}`); }
}

const prisma = new PrismaClient();
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;
function estimateBytesFromDataUrl(d: string) {
  const i = d.indexOf(','); const b64 = i >= 0 ? d.slice(i+1) : d;
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
}

export async function POST(req: Request) {
  try {
    rateLimit('admin:' + (req.headers.get('x-forwarded-for') ?? 'local'));
    const admin = await requireAdmin();

    const payload = await parseEventRequest(req);
    const normalized = {
      title: (payload.title ?? payload.name ?? '').toString().trim(),
      description: payload.description,
      location: payload.location,
      startDate: payload.startDate,
      endDate: payload.endDate,
      eventType: payload.eventType ?? 'OTHER',
      parentFestivalId: payload.parentFestivalId ?? null,
      imageDataUrl: opt(payload.imageDataUrl),
      imageUrl: opt(payload.imageUrl),
      imageFile: (payload as any).imageFile instanceof File ? (payload as any).imageFile : undefined,
    };

    const input = EventInput.parse(normalized);

    // idempotency: same title + startDate
    const existing = await prisma.event.findFirst({
      where: { title: input.title ?? (normalized as any).title, startDate: input.startDate }
    });
    if (existing) {
      return NextResponse.json({ id: existing.id, message: 'Event already exists' }, { status: 409 });
    }

    // map string → enum, default OTHER
    const eType = (Object.keys(EventType) as (keyof typeof EventType)[])
      .includes((input.eventType ?? 'OTHER').toUpperCase() as any)
      ? (input.eventType ?? 'OTHER').toUpperCase()
      : 'OTHER';

    let imageUrl: string | null = null;
    const label = input.title ?? (normalized as any).title ?? null;

    if (normalized.imageFile instanceof File) {
      const buf = Buffer.from(await normalized.imageFile.arrayBuffer());
      const mime = normalized.imageFile.type || 'image/jpeg';
      const approx = buf.length;
      if (approx > MAX_BYTES) throw new Error(`Image too large (~${approx} bytes)`);
      const ext = mime.split('/')[1] ?? 'jpg';
      const path = buildObjectPath('events', label, ext);
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      imageUrl = await time('storage.upload', () => uploadDataUrlToSupabase(dataUrl, path));
    } else if (input.imageDataUrl) {
      const approx = estimateBytesFromDataUrl(input.imageDataUrl);
      if (approx > MAX_BYTES) throw new Error(`Image too large (~${approx} bytes)`);
      const ext = input.imageDataUrl.split(';')[0].split('/')[1] ?? 'jpg';
      const path = buildObjectPath('events', label, ext);
      imageUrl = await time('storage.upload', () => uploadDataUrlToSupabase(input.imageDataUrl!, path));
    } else if (input.imageUrl) {
      imageUrl = input.imageUrl;
    } else if (process.env.FOLIO_ALLOW_CREATE_WITHOUT_IMAGE === 'true') {
      imageUrl = null;
    } else {
      throw new Error('image required');
    }

    const event = await prisma.event.create({
      data: {
        title: input.title ?? (normalized as any).title,
        description: input.description,
        location: input.location,
        startDate: input.startDate,
        endDate: input.endDate,
        createdById: (admin as any).id,
        parentFestivalId: normalized.parentFestivalId,
        imageUrl,
        eventTypes: { set: [EventType[eType as keyof typeof EventType]] },
        isApproved: true,
        isPublic: true,
      }
    });

    return NextResponse.json({ ok: true, id: event.id, title: event.title, imageUrl }, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? (err.name === 'ZodError' ? 400 : 500);
    console.error('[upload failed]', { error: err?.message });
    return NextResponse.json({ error: err.message, issues: err.issues ?? undefined }, { status });
  }
} 