import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getVendorContext } from "./vendorContext";

export async function assertVendorAccess() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }

  if (session.user.role !== 'VENDOR') {
    throw new Error("Vendor role required");
  }

  const vendorCtx = await getVendorContext();
  if (!vendorCtx) {
    throw new Error("Vendor context required");
  }

  return vendorCtx;
}

export async function validateVendorOwnership(vendorOrgId: string) {
  const vendorCtx = await assertVendorAccess();
  
  if (vendorCtx.vendorOrgId !== vendorOrgId) {
    throw new Error("Forbidden: Cannot access other vendor's resources");
  }
  
  return vendorCtx;
}




