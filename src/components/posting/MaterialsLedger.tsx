"use client";

interface MaterialsLedgerProps {
  ledger: any[];
}

export function MaterialsLedger({ ledger }: MaterialsLedgerProps) {
  if (!ledger || ledger.length === 0) return null;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Materials</h2>
      <div className="border border-[var(--ridge-outer)] rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-[var(--ridge-outer)]">
          <thead className="bg-[var(--bg-elevated)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Finish
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Note
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--ridge-outer)]">
            {ledger.map((item, idx) => (
              <tr key={idx}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text-primary)]">
                  {item.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                  {item.finish || "—"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                  {item.vendorName || "—"}
                </td>
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                  {item.note || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

