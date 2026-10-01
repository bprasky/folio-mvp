import { assertMediaActor } from '@/lib/interview-media/http';
import { mediaPlayback } from '@/lib/interview-media/service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: { id: string } }) {
  return assertMediaActor(actor => mediaPlayback(actor, params.id, new URL(request.url).searchParams.get('purpose') === 'export' ? 'export' : 'preview'));
}
