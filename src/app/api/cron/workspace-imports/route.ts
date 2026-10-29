// @idor-allow: public-read reason="Durable import processing requires the configured CRON_SECRET, and each unit rechecks the initiating actor's business permissions."
import { processWorkspaceImports } from '@/lib/workspace-import/processor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try { return Response.json(await processWorkspaceImports(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Import processing is temporarily unavailable. Saved progress will be retried.' }, { status: 503 }); }
}
