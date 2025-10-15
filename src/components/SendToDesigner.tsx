"use client";
import { useState } from "react";

export default function SendToDesigner({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [visitUrl, setVisitUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setVisitUrl(null); setCopied(false);
    try {
      const res = await fetch(`/api/vendor/projects/${projectId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ designerEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send handoff");
      setVisitUrl(data.visitUrl);
      try { await navigator.clipboard.writeText(data.visitUrl); setCopied(true); } catch {}
    } catch (e: any) {
      setErr(e?.message || "Failed to send handoff");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="text-sm block mb-1">Designer Email</label>
        <input className="border rounded px-2 py-1 text-sm w-full" type="email" required
               placeholder="designer@folio.com" value={email}
               onChange={e => setEmail(e.target.value)} />
      </div>
      <button className="border rounded px-3 py-1 text-sm disabled:opacity-60" disabled={busy} type="submit">
        {busy ? "Sending…" : "Send to Designer"}
      </button>
      {err && <span className="text-sm text-red-600 ml-2">{err}</span>}
      {visitUrl && (
        <span className="text-xs ml-2">
          Link ready{copied ? " (copied)" : ""}. Designer will also see this in Inbox.
        </span>
      )}
    </form>
  );
}
