"use client";
import { Product } from "@/lib/mock/product";

export function VendorInsightsMini({ product }: { product: Product }) {
  const i = product.insights;
  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Saves" value={i.saves} />
        <Kpi label="Tags" value={i.tags} />
        <Kpi label="Save→Tag" value={`${i.saveToTagPct}%`} />
      </div>
      
      {/* Lists */}
      <div className="grid grid-cols-2 gap-6">
        <List label="Top Rooms" items={i.topRooms.map(r=>`${r.label} ${r.pct}%`)} />
        <List label="Top Markets" items={i.topMarkets.map(m=>`${m.city} ${m.pct}%`)} />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number|string }) {
  return (
    <div className="rounded-xl border border-folio-border-subtle dark:border-folio-border-subtle bg-white/50 dark:bg-surface-elevated/50 p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-folio-text-tertiary dark:text-folio-text-tertiary">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-folio-text-primary dark:text-folio-text-tertiary">
        {value}
      </div>
    </div>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-folio-text-tertiary dark:text-folio-text-tertiary mb-2">
        {label}
      </div>
      <ul className="space-y-1">
        {items.map((t,i)=>(
          <li key={i} className="text-sm text-folio-text-secondary dark:text-folio-text-tertiary flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-stone-400 dark:bg-surface-elevated" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}


