import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  // assumes session.user.role === 'ADMIN' or similar
  if ((session.user as any).role !== 'ADMIN') throw Object.assign(new Error('Forbidden'), { status: 403 });
  return session.user;
}







