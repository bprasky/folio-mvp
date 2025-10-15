'use client'
import * as React from 'react'
import type { HandoffQuotePayload } from '@/types/handoff'

type Props = {
  quote: HandoffQuotePayload | undefined
  onChange: (q: HandoffQuotePayload | undefined) => void
  className?: string
}

export default function QuoteAndDeliveryCard({ quote, onChange, className }: Props) {
  const [mode, setMode] = React.useState<'file'|'structured'>(quote?.kind ?? 'file')
  const [sendEmail, setSendEmail] = React.useState(true)
  const [expiresAt, setExpiresAt] = React.useState<string>('')

  // NOTE: For file uploads, assume the app already provides an upload path and returns fileUrl/fileName.
  function setFile(url: string, name: string) {
    onChange({ kind: 'file', fileUrl: url, fileName: name, expiresAt: expiresAt || undefined })
  }

  function setStructured(upd: Partial<Extract<HandoffQuotePayload, {kind:'structured'}>>) {
    onChange({
      kind: 'structured',
      totalCents: upd.totalCents,
      currency: upd.currency ?? 'USD',
      leadTimeDays: upd.leadTimeDays,
      termsShort: upd.termsShort,
      expiresAt: expiresAt || undefined,
      jsonPayload: upd.jsonPayload
    })
  }

  return (
    <div className={`border rounded-2xl p-6 bg-white ${className ?? ''}`}>
      <h3 className="text-lg font-semibold mb-2">Quote & delivery</h3>
      <p className="text-sm text-gray-500 mb-4">Attach a PDF or enter totals. Versions are tracked automatically.</p>

      <div className="flex gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode==='file'} onChange={() => { setMode('file'); onChange(undefined) }} />
          PDF / Doc
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode==='structured'} onChange={() => { setMode('structured'); onChange(undefined) }} />
          Structured
        </label>
      </div>

      {mode === 'file' ? (
        <div className="grid gap-2">
          <input type="url" placeholder="Quote file URL (pre-uploaded)" className="border rounded-xl px-3 py-2"
            onChange={e => setFile(e.target.value, e.target.value.split('/').pop() ?? 'quote.pdf')} />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          <input className="border rounded-xl px-3 py-2" placeholder="Total (cents)" type="number"
            onChange={e => setStructured({ totalCents: Number(e.target.value) || undefined })}/>
          <input className="border rounded-xl px-3 py-2" placeholder="Currency" defaultValue="USD"
            onChange={e => setStructured({ currency: e.target.value || 'USD' })}/>
          <input className="border rounded-xl px-3 py-2" placeholder="Lead time (days)" type="number"
            onChange={e => setStructured({ leadTimeDays: Number(e.target.value) || undefined })}/>
          <input className="border rounded-xl px-3 py-2" placeholder="Short terms"
            onChange={e => setStructured({ termsShort: e.target.value || undefined })}/>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 mt-4">
        <input type="date" className="border rounded-xl px-3 py-2" onChange={e => setExpiresAt(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendEmail} onChange={() => setSendEmail(v => !v)} />
          Send email to designer now
        </label>
      </div>

      <input type="hidden" name="__sendEmail" value={String(sendEmail)} />
      <input type="hidden" name="__expiresAt" value={expiresAt} />
    </div>
  )
}




