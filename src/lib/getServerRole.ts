import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function getServerRole() {
  const session = await getServerSession(authOptions);
  return session?.user?.role ?? null;
}


