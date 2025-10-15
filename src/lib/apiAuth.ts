import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

export async function getUserIdFromRequest(req: Request) {
  const s = await getServerSession().catch(() => null);
  if (s?.user?.id) return s.user.id;
  try {
    const t = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    if (t?.sub) return String(t.sub);
    if ((t as any)?.id) return String((t as any).id);
  } catch {}
  if (process.env.NODE_ENV !== "production") {
    const dev = req.headers.get("x-dev-user-id");
    if (dev) return dev;
  }
  return null;
}



