import Link from 'next/link';

export default function DesignerAnalyticsPage() {
  return (
    <main className="mx-auto max-w-2xl p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Analytics preview retired</h1>
      <p>The sample analytics dashboard is no longer available. It did not show your account data or submit boost and review requests.</p>
      <Link href="/designer" className="underline">Open designer dashboard</Link>
    </main>
  );
}