import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/apiAuth";

export async function POST(req: Request, { params }: { params: { id: string }}) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // In a real build, enqueue a notification or update a field on project/selections.
  return NextResponse.json({ ok: true, projectId: params.id }, { status: 200 });
}



