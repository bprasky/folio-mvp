"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type InboxItem = {
  id: string;
  token: string;
  createdAt: string;
  project?: { id: string; title?: string | null; handoffClaimedAt?: string | null };
};

export default function DesignerInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch("/api/designer/inbox/handoffs", { credentials: "include", cache: "no-store" })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setItems([]));
  }, []);
  const count = items.length;

  return (
    <div className="relative">
      <button className="relative border rounded px-3 py-1 text-sm" onClick={() => setOpen(v => !v)}>
        Inbox {count ? <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-amber-600 text-white">{count}</span> : null}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 border rounded-lg bg-white shadow">
          <div className="p-2 text-sm font-medium border-b">Handoffs</div>
          <ul className="max-h-80 overflow-auto">
            {items.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">No handoffs yet.</li>
            ) : (
              items.map(it => (
                <li key={it.id} className="p-3 border-b text-sm">
                  <div className="font-medium">{it.project?.title || "Untitled Project"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(it.createdAt).toLocaleString()}</div>
                  <div className="mt-2">
                    <Link className="underline text-xs" href={`/visit/${it.token}`}>Open</Link>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
