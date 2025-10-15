"use client";

import { useState } from "react";

type Props = {
  projectId: string;
  className?: string;
};

async function postAction(projectId: string, path: string) {
  const res = await fetch(`/api/vendor/projects/${projectId}/quick-actions/${path}`, {
    method: "POST",
    credentials: "include",
  });
  // Non-blocking: OK if these endpoints are stubs
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Request failed");
}

export default function QuickActions({ projectId, className }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(label: string, path: string) {
    setBusy(label);
    setMsg(null);
    try {
      await postAction(projectId, path);
      setMsg(`${label} sent`);
    } catch (e: any) {
      setMsg(e?.message || `${label} failed`);
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 2000);
    }
  }

  const btn = (label: string, path: string) => (
    <button
      key={path}
      className="border rounded px-2 py-1 text-xs disabled:opacity-60"
      onClick={() => run(label, path)}
      disabled={!!busy}
    >
      {busy === label ? `${label}…` : label}
    </button>
  );

  return (
    <div className={className ?? "flex items-center gap-2"}>
      {btn("Offer to Boost", "offer-boost")}
      {btn("Invite to Event", "invite-to-event")}
      {btn("Extend Discount", "extend-discount")}
      {msg && <span className="text-xs text-muted-foreground ml-2">{msg}</span>}
    </div>
  );
}