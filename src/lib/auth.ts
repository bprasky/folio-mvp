// src/lib/auth.ts
// Central export for NextAuth options so server components can `getServerSession(authOptions)`
// This re-exports from your API route to avoid duplicating config.
export { authOptions } from '@/app/api/auth/[...nextauth]/options';

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export async function auth() {
  return getServerSession(authOptions);
}
