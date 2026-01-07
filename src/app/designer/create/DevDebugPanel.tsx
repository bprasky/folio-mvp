'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function DevDebugPanel() {
  if (process.env.NODE_ENV === 'production') return null;
  const { data: session, status } = useSession();
  const [cookie, setCookie] = useState<string>('');
  const [ping, setPing] = useState<any>(null);
  const [serverSession, setServerSession] = useState<any>(null);

  useEffect(() => {
    try {
      setCookie(document.cookie || '');
    } catch {}
  }, []);

  async function testCreate() {
    setPing('...');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: 'Dev Test',
          projectType: 'TEST',
          stage: 'TEST',
          clientType: 'TEST',
          location: 'NYC',
          budget: 1,
        }),
      });
      const body = await res.json().catch(() => ({}));
      setPing({ status: res.status, body });
    } catch (e: any) {
      setPing({ error: e?.message || String(e) });
    }
  }

  async function readServerSession() {
    try {
      const res = await fetch('/api/debug/session', { credentials: 'same-origin' });
      const j = await res.json();
      setServerSession(j);
    } catch (e: any) {
      setServerSession({ error: e?.message || String(e) });
    }
  }

  return (
    <div className="mt-6 rounded-lg border p-3 text-xs bg-gray-50">
      <div className="font-semibold mb-2">Dev Debug — Designer Create</div>
      <div>Status: {status}</div>
      <div>User ID: {(session?.user as any)?.id || '—'}</div>
      <div>Role: {session?.user?.role || '—'}</div>
      <div className="break-all">Cookie (client, HttpOnly so often blank): {cookie || '—'}</div>
      <button
        onClick={testCreate}
        className="mt-2 rounded border px-2 py-2 bg-white hover:bg-gray-100"
      >
        Test POST /api/projects
      </button>
      <button
        onClick={readServerSession}
        className="mt-2 ml-2 rounded border px-2 py-2 bg-white hover:bg-gray-100"
      >
        Read /api/debug/session
      </button>
      <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(ping, null, 2)}</pre>
      <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(serverSession, null, 2)}</pre>
    </div>
  );
}
