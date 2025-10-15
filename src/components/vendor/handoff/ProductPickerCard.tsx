'use client'
import * as React from 'react'
import type { HandoffProductItem } from '@/types/handoff'

type Props = {
  items: HandoffProductItem[]
  onChange: (items: HandoffProductItem[]) => void
  className?: string
}

// NOTE: This is a minimal, vendor-catalog-agnostic picker scaffolding.
// Replace the "Add manual item" flow with your catalog search when ready.
export default function ProductPickerCard({ items, onChange, className }: Props) {
  const [draft, setDraft] = React.useState<HandoffProductItem>({})

  function addItem() {
    if (!draft.sku && !draft.productId) return
    onChange([...items, draft])
    setDraft({})
  }

  function removeAt(idx: number) {
    const next = items.slice()
    next.splice(idx, 1)
    onChange(next)
  }

  return (
    <div className={`border rounded-2xl p-6 bg-white ${className ?? ''}`}>
      <h3 className="text-lg font-semibold mb-2">Products to include</h3>
      <p className="text-sm text-gray-500 mb-4">
        Add a few key items (SKU and finish if possible). You can swap to a catalog picker later.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input className="border rounded-xl px-3 py-2" placeholder="Product ID (optional)" value={draft.productId ?? ''} onChange={e => setDraft(d => ({...d, productId: e.target.value || undefined}))}/>
        <input className="border rounded-xl px-3 py-2" placeholder="SKU" value={draft.sku ?? ''} onChange={e => setDraft(d => ({...d, sku: e.target.value || undefined}))}/>
        <input className="border rounded-xl px-3 py-2" placeholder="Finish" value={draft.finish ?? ''} onChange={e => setDraft(d => ({...d, finish: e.target.value || undefined}))}/>
        <input className="border rounded-xl px-3 py-2" placeholder="Quantity" type="number" min={1} value={draft.quantity ?? 1} onChange={e => setDraft(d => ({...d, quantity: Number(e.target.value) || 1}))}/>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={addItem} className="px-4 py-2 rounded-xl bg-black text-white">Add item</button>
        <span className="text-xs text-gray-400 self-center">Tip: keep it tight — quality over quantity.</span>
      </div>

      {items.length > 0 && (
        <div className="mt-5">
          <h4 className="font-medium mb-2">Included</h4>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={i} className="flex items-center justify-between border rounded-xl p-3">
                <div className="text-sm">
                  <div className="font-medium">{it.sku ?? it.productId ?? 'Untitled'}</div>
                  <div className="text-gray-500">{[it.finish, it.quantity ? `Qty ${it.quantity}` : null].filter(Boolean).join(' • ')}</div>
                </div>
                <button onClick={() => removeAt(i)} className="text-red-600 text-sm">Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}




