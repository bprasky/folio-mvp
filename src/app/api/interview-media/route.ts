import { assertMediaActor, smallJson } from '@/lib/interview-media/http';
import { createPlan, mediaLibrary, mediaAction } from '@/lib/interview-media/service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return assertMediaActor(actor => mediaLibrary(actor, new URL(request.url).searchParams.get('sessionId') || undefined)); }
export async function POST(request: Request) { return assertMediaActor(async actor => createPlan(actor, await smallJson(request))); }
export async function PATCH(request: Request) { return assertMediaActor(async actor => mediaAction(actor, await smallJson(request))); }
