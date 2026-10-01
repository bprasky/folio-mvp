import { assertMediaActor, smallJson } from '@/lib/interview-media/http';
import { captureAction } from '@/lib/interview-media/service';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return assertMediaActor(async actor => captureAction(actor, await smallJson(request))); }
