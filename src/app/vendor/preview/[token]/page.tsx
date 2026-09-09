import Link from 'next/link';

// Old tokens convey no authority and no longer expose project or product context.
export default function VendorPreviewPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Product preview claims have moved</h1>
      <p>This legacy link can no longer claim a product. Sign in and complete your organization setup. Existing product claims require an active vendor membership and organization verification by Folio.</p>
      <p><Link href="/auth/org-setup" className="underline">Set up your organization</Link></p>
      <p><Link href="/vendor/review" className="underline">Review your organization&apos;s product candidates</Link></p>
    </main>
  );
}
