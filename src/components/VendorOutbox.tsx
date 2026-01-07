"use client";
import { useEffect, useState } from "react";

type Visit = {
  id: string;
  token: string;
  createdAt: string;
  designerEmail?: string | null;
  project?: { id: string; title?: string | null; handoffClaimedAt?: string | null };
};

function fmt(d?: string | null) {
  try { return d ? new Date(d).toLocaleString() : ""; } catch { return ""; }
}

function StatusPill({ claimedAt }: { claimedAt?: string | null }) {
  const claimed = !!claimedAt;
  const label = claimed ? "Claimed" : "Sent";
  const cls = claimed ? "bg-emerald-600" : "bg-amber-600";
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded text-white ${cls}`}>{label}</span>;
}

export default function VendorOutbox({ projectId, limit = 10 }: { projectId?: string; limit?: number }) {
  const [items, setItems] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = projectId ? `/api/vendor/projects/${projectId}/visits` : `/api/vendor/visits?limit=${limit}`;
    fetch(url, { credentials: "include", cache: "no-store" })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [projectId, limit]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Sent Handoffs</h3>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No handoffs yet.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Recipient</th>
                <th className="text-left px-3 py-2">Project</th>
                <th className="text-left px-3 py-2">Sent</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(v => {
                // remove base/origin logic; use relative link (still copyable)
                const url = `/visit/${v.token}`;
                return (
                  <tr key={v.id} className="border-t">
                    <td className="px-3 py-2">
                      <StatusPill claimedAt={v.project?.handoffClaimedAt} />
                    </td>
                    <td className="px-3 py-2">{v.designerEmail || "—"}</td>
                    <td className="px-3 py-2">{v.project?.title || "Untitled"}</td>
                    <td className="px-3 py-2">{fmt(v.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-xs underline"
                        // In the Copy handler:
                        onClick={() => navigator.clipboard.writeText(`${location.origin}${url}`)}
                        title="Copy private claim link"
                      >
                        Copy link
                      </button>
                      {/* No "Open" link to /visit/* to avoid vendor→designer redirect in demo */}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
