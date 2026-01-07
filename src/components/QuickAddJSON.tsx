"use client";
import { useState } from "react";

export default function QuickAddJSON({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(`[{"name":"Bar Stool","sku":"BS-12","price":199,"quantity":3}]`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null); setBusy(true);
    try {
      const items = JSON.parse(payload);
      const res = await fetch(`/api/vendor/projects/${projectId}/selections/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setOpen(false);
      location.reload();
    } catch (e:any) { setErr(e.message || "Invalid JSON"); }
    finally { setBusy(false); }
  }

  return (
    <div className="inline-block">
      <button className="border border-gray-300 rounded px-3 py-2 text-sm hover:bg-gray-50 transition-colors" onClick={()=>setOpen(true)}>
        Quick Add (JSON)
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 w-[520px] space-y-3">
            <h3 className="font-medium text-gray-900">Paste items (JSON array)</h3>
            <textarea 
              className="w-full h-48 border border-gray-300 rounded p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={payload} 
              onChange={e=>setPayload(e.target.value)} 
            />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button 
                className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors" 
                onClick={()=>setOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="border border-gray-300 rounded px-3 py-2 hover:bg-gray-50 transition-colors" 
                disabled={busy} 
                onClick={submit}
              >
                {busy ? "Adding…" : "Add Items"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



