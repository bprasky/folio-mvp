"use client";
import { Product } from "@/lib/mock/product";

export function VendorInsightsMini({ product }: { product: Product }) {
  const i = product.insights;
  const hasData = i.saves > 0 || i.tags > 0 || i.topRooms.length > 0 || i.topMarkets.length > 0;
  if (!hasData) return null;

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
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white/50 dark:bg-stone-800/50 p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-stone-900 dark:text-stone-100">
        {value}
      </div>
    </div>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
        {label}
      </div>
      <ul className="space-y-1">
        {items.map((t,i)=>(
          <li key={i} className="text-sm text-stone-700 dark:text-stone-300 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-600" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}


