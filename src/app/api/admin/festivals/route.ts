import { NextResponse } from 'next/server';
import { PrismaClient, EventType } from '@prisma/client';
import { uploadDataUrlToSupabase, buildObjectPath } from '@/lib/uploadToSupabase';
import { time } from '@/lib/telemetry';
import { requireAdmin } from '@/lib/requireAdmin';
import { rateLimit } from '@/lib/rateLimit';
import { FestivalInput } from '@/lib/validators';

function coerceBool(v: unknown) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'on' || s === 'yes';
}

// helper to normalize empty strings to undefined
const opt = (v: unknown) => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length ? s : undefined;
};

async function parseFestivalRequest(req: Request) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await req.json();
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    const title = form.get('title')?.toString() ?? form.get('name')?.toString() ?? '';
    const description = form.get('description')?.toString() ?? '';
    const location = form.get('location')?.toString() ?? '';
    const startDate = form.get('startDate')?.toString() ?? '';
    const endDate = form.get('endDate')?.toString() ?? '';
    const imageDataUrl = opt(form.get('imageDataUrl')?.toString() ?? '');
    const imageUrl = opt(form.get('imageUrl')?.toString() ?? '');
    let imageFile: File | undefined;
    const f = (form.get('image') ?? form.get('file') ?? form.get('photo'));
    if (f instanceof File) imageFile = f;
    return { title, description, location, startDate, endDate, imageDataUrl, imageUrl, imageFile };
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

    const payload = await parseFestivalRequest(req);
    // normalize name/title to title (schema uses `title`)
    const normalized = { 
      title: (payload.title ?? payload.name ?? '').toString().trim(),
      description: payload.description,
      location: payload.location,
      startDate: payload.startDate,
      endDate: payload.endDate,
      imageDataUrl: opt(payload.imageDataUrl),
      imageUrl: opt(payload.imageUrl),
      imageFile: (payload as any).imageFile instanceof File ? (payload as any).imageFile : undefined,
    };

    const input = FestivalInput.parse(normalized);

    // idempotency: same title + same startDate + is FESTIVAL, top-level
    const existing = await prisma.event.findFirst({
      where: {
        title: input.title ?? (normalized as any).title,
        startDate: input.startDate,
        parentFestivalId: null,
        eventTypes: { has: 'FESTIVAL' }
      }
    });
    if (existing) {
      return NextResponse.json({ id: existing.id, message: 'Festival already exists' }, { status: 409 });
    }

    // image handling (file -> dataURL -> URL)
    let imageUrl: string | null = null;
    const label = input.title ?? (normalized as any).title ?? null;

    if (normalized.imageFile instanceof File) {
      const buf = Buffer.from(await normalized.imageFile.arrayBuffer());
      const mime = normalized.imageFile.type || 'image/jpeg';
      const approx = buf.length;
      if (approx > MAX_BYTES) throw new Error(`Image too large (~${approx} bytes)`);
      const ext = mime.split('/')[1] ?? 'jpg';
      const path = buildObjectPath('festivals', label, ext);
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      imageUrl = await time('storage.upload', () => uploadDataUrlToSupabase(dataUrl, path));
    } else if (input.imageDataUrl) {
      const approx = estimateBytesFromDataUrl(input.imageDataUrl);
      if (approx > MAX_BYTES) throw new Error(`Image too large (~${approx} bytes)`);
      const ext = input.imageDataUrl.split(';')[0].split('/')[1] ?? 'jpg';
      const path = buildObjectPath('festivals', label, ext);
      imageUrl = await time('storage.upload', () => uploadDataUrlToSupabase(input.imageDataUrl!, path));
    } else if (input.imageUrl) {
      imageUrl = input.imageUrl;
    } else if (process.env.FOLIO_ALLOW_CREATE_WITHOUT_IMAGE === 'true') {
      imageUrl = null;
    } else {
      throw new Error('image required');
    }

    // CREATE the festival (Event row with type FESTIVAL)
    const festival = await prisma.event.create({
      data: {
        title: input.title ?? (normalized as any).title,
        description: input.description,
        location: input.location,
        startDate: input.startDate,
        endDate: input.endDate,
        createdById: (admin as any).id,
        parentFestivalId: null,
        imageUrl,
        eventTypes: { set: [EventType.FESTIVAL] },
        isApproved: true,
        isPublic: true,
      }
    });

    return NextResponse.json({ ok: true, id: festival.id, title: festival.title, imageUrl }, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? (err.name === 'ZodError' ? 400 : 500);
    console.error('[upload failed]', { error: err?.message });
    return NextResponse.json({ error: err.message, issues: err.issues ?? undefined }, { status });
  }
} 