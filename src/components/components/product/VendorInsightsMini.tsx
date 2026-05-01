"use client";
import React from "react";
import { Product } from "@/lib/mock/product";
import { Card } from "@/components/ui/card";

export function VendorInsightsMini({ product }: { product: Product }) {
  const i = product.insights;
  return (
    <Card className="p-4">
      <div className="text-sm text-[#6B7280]">Product Insights</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Kpi label="Saves" value={i.saves} />
        <Kpi label="Tags" value={i.tags} />
        <Kpi label="Save→Tag" value={`${i.saveToTagPct}%`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <List label="Top Rooms" items={i.topRooms.map(r=>`${r.label} ${r.pct}%`)} />
        <List label="Top Markets" items={i.topMarkets.map(m=>`${m.city} ${m.pct}%`)} />
      </div>
    </Card>
  );
}
function Kpi({ label, value }: { label: string; value: number|string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-2">
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className="text-[var(--type-body)] font-semibold text-[#111827]">{value}</div>
    </div>
  );
}
function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs text-[#6B7280]">{label}</div>
      <ul className="mt-1 list-disc pl-4 text-[var(--type-meta)] text-[#111827]">
        {items.map((t,i)=><li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}
