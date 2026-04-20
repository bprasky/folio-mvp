import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { uploadDataUrlToSupabase, buildObjectPath } from '@/lib/uploadToSupabase';

// Define EventType locally since it may not be in Prisma schema yet
const EventType = {
  FESTIVAL: 'FESTIVAL',
  SHOWROOM: 'SHOWROOM',
  EXHIBITION: 'EXHIBITION',
  TALK: 'TALK',
  WORKSHOP: 'WORKSHOP',
  NETWORKING: 'NETWORKING',
  OTHER: 'OTHER',
} as const;
import { requireAdmin } from '@/lib/requireAdmin';
import { rateLimit } from '@/lib/rateLimit';
import { FestivalInput } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole, canAccessAdmin } from '@/lib/permissions';

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
  if (ct.includes('application/json')) {
    const json = await req.json();
    // Explicitly extract only allowed fields - filter out address1, address2, etc.
    return {
      title: json.title,
      name: json.name,
      description: json.description,
      location: json.location,
      startDate: json.startDate,
      endDate: json.endDate,
      city: json.city,
      state: json.state,
      country: json.country,
      imageDataUrl: json.imageDataUrl,
      imageUrl: json.imageUrl,
      imageFile: json.imageFile,
      // Explicitly do NOT include: address1, address2, postalCode, latitude, longitude
    };
  }
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    const title = form.get('title')?.toString() ?? form.get('name')?.toString() ?? '';
    const description = form.get('description')?.toString() ?? '';
    const location = form.get('location')?.toString() ?? '';
    const startDate = form.get('startDate')?.toString() ?? '';
    const endDate = form.get('endDate')?.toString() ?? '';
    const city = opt(form.get('city')?.toString() ?? '');
    const state = opt(form.get('state')?.toString() ?? '');
    const country = opt(form.get('country')?.toString() ?? '');
    const imageDataUrl = opt(form.get('imageDataUrl')?.toString() ?? '');
    const imageUrl = opt(form.get('imageUrl')?.toString() ?? '');
    let imageFile: File | undefined;
    const f = (form.get('image') ?? form.get('file') ?? form.get('photo'));
    if (f instanceof File) imageFile = f;
    // Explicitly return only allowed fields - form.get('address1') etc. are NOT extracted
    return { title, description, location, startDate, endDate, city, state, country, imageDataUrl, imageUrl, imageFile };
  }
  try { 
    const json = await req.json();
    // Same filtering as JSON case
    return {
      title: json.title,
      name: json.name,
      description: json.description,
      location: json.location,
      startDate: json.startDate,
      endDate: json.endDate,
      city: json.city,
      state: json.state,
      country: json.country,
      imageDataUrl: json.imageDataUrl,
      imageUrl: json.imageUrl,
      imageFile: json.imageFile,
    };
  }
  catch { throw new Error(`Unsupported Content-Type: ${ct}`); }
}

const prisma = new PrismaClient();
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

// Helper to get columns that actually exist in the events table
async function getExistingEventColumns(): Promise<Set<string>> {
  try {
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'events'
      ORDER BY column_name;
    `) as Array<{ column_name: string }>;
    return new Set(columns.map(col => col.column_name));
  } catch (error) {
    console.error('Failed to query database schema:', error);
    // Fallback to a minimal set of known fields
    return new Set(['id', 'title', 'description', 'location', 'startDate', 'endDate', 'createdById', 'parentFestivalId', 'imageUrl', 'eventTypes', 'isApproved', 'isPublic']);
  }
}

// Helper to filter data object to only include fields that exist in the database
function filterToExistingFields(data: Record<string, any>, existingColumns: Set<string>): Record<string, any> {
  const filtered: Record<string, any> = {};
  
  // Explicitly list fields that are known to exist (safe whitelist approach)
  const SAFE_FIELDS = new Set([
    'title', 'description', 'location', 'startDate', 'endDate', 
    'createdById', 'parentFestivalId', 'imageUrl', 'eventTypes',
    'isApproved', 'isPublic'
  ]);
  
  // Fields that definitely DON'T exist (blacklist)
  const EXCLUDED_FIELDS = new Set([
    'address1', 'address2', 'postalCode', 'latitude', 'longitude',
    'city', 'state', 'country' // These may not exist yet
  ]);
  
  for (const [key, value] of Object.entries(data)) {
    // Skip excluded fields completely
    if (EXCLUDED_FIELDS.has(key)) {
      console.log(`[festival create] EXCLUDING field '${key}' - not in database`);
      continue;
    }
    
    if (value === undefined || value === null) continue;
    
    // Special handling for nested objects like { set: [...] } - these are Prisma operations
    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && key === 'eventTypes') {
      filtered[key] = value; // Prisma handles these operations
      continue;
    }
    
    // Only include if it's in the safe fields list OR exists in database
    if (SAFE_FIELDS.has(key)) {
      filtered[key] = value;
    } else if (existingColumns.has(key)) {
      // Additional safety: check if it exists in database
      filtered[key] = value;
      console.log(`[festival create] Including field '${key}' - found in database`);
    } else {
      // Log skipped fields for debugging
      console.log(`[festival create] Skipping field '${key}' - not in safe list or database`);
    }
  }
  
  console.log(`[festival create] Filtered data keys:`, Object.keys(filtered));
  return filtered;
}
function estimateBytesFromDataUrl(d: string) {
  const i = d.indexOf(','); const b64 = i >= 0 ? d.slice(i+1) : d;
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessAdmin(normalizeRole((session.user as any).role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    rateLimit({
      userId: req.headers.get('x-forwarded-for') ?? 'local',
      scope: 'admin:festivals',
      limit: 100,
      windowMs: 60000
    });
    const admin = await requireAdmin();

    const payload = await parseFestivalRequest(req);
    // normalize name/title to title (schema uses `title`)
    // Explicitly extract only the fields we need - DO NOT spread payload to avoid including unknown fields
    const normalized = { 
      title: (payload.title ?? payload.name ?? '').toString().trim(),
      description: payload.description,
      location: payload.location,
      startDate: payload.startDate,
      endDate: payload.endDate,
      city: opt(payload.city),
      state: opt(payload.state),
      country: opt(payload.country),
      imageDataUrl: opt(payload.imageDataUrl),
      imageUrl: opt(payload.imageUrl),
      imageFile: (payload as any).imageFile instanceof File ? (payload as any).imageFile : undefined,
      // Explicitly exclude address1, address2, postalCode, latitude, longitude - these don't exist in current DB
    };

    const input = FestivalInput.parse(normalized);

    // idempotency: same title + same startDate + is FESTIVAL, top-level
    // Use select to explicitly choose fields that exist in the database (exclude address1, address2, etc.)
    const existing = await prisma.event.findFirst({
      where: {
        title: input.title ?? (normalized as any).title,
        startDate: input.startDate,
        parentFestivalId: null,
        eventTypes: { has: 'FESTIVAL' }
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        parentFestivalId: true,
        eventTypes: true,
        // Explicitly exclude: address1, address2, postalCode, latitude, longitude - these may not exist in DB
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
      imageUrl = await uploadDataUrlToSupabase(dataUrl, path);
    } else if (input.imageDataUrl) {
      const approx = estimateBytesFromDataUrl(input.imageDataUrl);
      if (approx > MAX_BYTES) throw new Error(`Image too large (~${approx} bytes)`);
      const ext = input.imageDataUrl.split(';')[0].split('/')[1] ?? 'jpg';
      const path = buildObjectPath('festivals', label, ext);
      imageUrl = await uploadDataUrlToSupabase(input.imageDataUrl!, path);
    } else if (input.imageUrl) {
      imageUrl = input.imageUrl;
    } else if (process.env.FOLIO_ALLOW_CREATE_WITHOUT_IMAGE === 'true') {
      imageUrl = null;
    } else {
      throw new Error('image required');
    }

    // CREATE the festival (Event row with type FESTIVAL)
    // Check which columns actually exist in the database
    const existingColumns = await getExistingEventColumns();
    
    // Build data object with all desired fields
    const eventData: Record<string, any> = {
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
    };

    // Conditionally add optional fields if they exist in the database
    if (existingColumns.has('city') && input.city) {
      eventData.city = input.city;
    }
    if (existingColumns.has('state') && input.state) {
      eventData.state = input.state;
    }
    if (existingColumns.has('country') && input.country) {
      eventData.country = input.country;
    }

    // Filter out any fields that don't exist in the database (safety check)
    const filteredData = filterToExistingFields(eventData, existingColumns);
    
    // Final safety: explicitly construct only the fields we know exist
    // Use raw SQL to bypass Prisma Client validation which may reference schema fields that don't exist in DB
    // Generate a CUID-like ID (Prisma's default format)
    const generateId = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 15);
      return `cl${timestamp}${random}`.substring(0, 25);
    };
    const id = generateId();
    
    // PostgreSQL array format for eventTypes
    const eventTypesArray = `{${EventType.FESTIVAL}}`;
    
    const insertQuery = `
      INSERT INTO events (
        id, title, description, location, "startDate", "endDate", 
        "createdById", "parentFestivalId", "imageUrl", "eventTypes", 
        "isApproved", "isPublic", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::"EventType"[], $11, $12, NOW(), NOW()
      ) RETURNING id, title, "imageUrl"
    `;
    
    const festival = await prisma.$queryRawUnsafe(
      insertQuery,
      id,
      filteredData.title,
      filteredData.description,
      filteredData.location,
      filteredData.startDate,
      filteredData.endDate,
      filteredData.createdById,
      filteredData.parentFestivalId,
      filteredData.imageUrl,
      eventTypesArray,
      filteredData.isApproved,
      filteredData.isPublic
    ) as Array<{ id: string; title: string; imageUrl: string | null }>;

    const createdFestival = festival[0];

    return NextResponse.json({ ok: true, id: createdFestival.id, title: createdFestival.title, imageUrl: createdFestival.imageUrl }, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? (err.name === 'ZodError' ? 400 : 500);
    console.error('[upload failed]', { error: err?.message });
    return NextResponse.json({ error: err.message, issues: err.issues ?? undefined }, { status });
  }
} 