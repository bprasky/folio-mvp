import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function getRole(): Promise<string | null> {
  const s = await getServerSession(authOptions);
  return (s?.user as any)?.role ?? null;
} 