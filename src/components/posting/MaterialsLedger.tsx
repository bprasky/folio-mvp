"use client";

interface MaterialsLedgerProps {
  ledger: any[];
}

export function MaterialsLedger({ ledger }: MaterialsLedgerProps) {
  if (!ledger || ledger.length === 0) return null;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-folio-text-primary mb-4">Materials</h2>
      <div className="border border-folio-border-subtle rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-[var(--ridge-outer)]">
          <thead className="bg-surface-ground">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Finish
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Note
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--ridge-outer)]">
            {ledger.map((item, idx) => (
              <tr key={idx}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-folio-text-primary">
                  {item.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-secondary">
                  {item.finish || "—"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-secondary">
                  {item.vendorName || "—"}
                </td>
                <td className="px-6 py-4 text-sm text-folio-text-secondary">
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

