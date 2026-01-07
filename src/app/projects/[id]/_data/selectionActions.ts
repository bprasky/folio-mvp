"use server";
import { getVendorContext } from "@/lib/auth/vendorContext";
import { assertProjectView } from "@/lib/authz/access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function createSelection(projectId: string, payload: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  const access = await assertProjectView(session.user.id, projectId);
  
  const ctx = await getVendorContext();
  if (!ctx) throw new Error("Vendor context required");

  // Force vendor attribution server-side
  const body = {
    ...payload,
    vendorOrgId: ctx.vendorOrgId,           // authoritative
    source: payload?.source ?? "vendor",    // helpful for analytics
  };

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/projects/${projectId}/selections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to create selection: ${response.statusText}`);
  }

  return response.json();
}

export async function updateSelection(projectId: string, selectionId: string, payload: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  const access = await assertProjectView(session.user.id, projectId);
  
  const ctx = await getVendorContext();
  if (!ctx) throw new Error("Vendor context required");

  const body = {
    ...payload,
    vendorOrgId: ctx.vendorOrgId, // keep attribution locked
  };

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/projects/${projectId}/selections/${selectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to update selection: ${response.statusText}`);
  }

  return response.json();
}
