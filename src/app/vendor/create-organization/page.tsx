import { redirect } from 'next/navigation';

// Vendor org creation now lives in the unified /auth/org-setup flow.
export const dynamic = 'force-dynamic';

export default function VendorCreateOrgRedirect() {
  redirect('/auth/org-setup?type=vendor');
}
