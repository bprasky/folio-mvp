'use client'
import * as React from 'react'
import RecipientEmailCard from './RecipientEmailCard'
import ProductPickerCard from './ProductPickerCard'
import QuoteAndDeliveryCard from './QuoteAndDeliveryCard'
import type { CreateHandoffRequest, HandoffProductItem, HandoffQuotePayload } from '@/types/handoff'

interface HandoffComposerProps {
  vendorCtx?: { vendorOrgId: string; vendor: { id: string; name: string; description?: string } } | null;
}

export default function HandoffComposer({ vendorCtx }: HandoffComposerProps = {}) {
  const [designerEmail, setDesignerEmail] = React.useState('')
  const [products, setProducts] = React.useState<HandoffProductItem[]>([])
  const [quote, setQuote] = React.useState<HandoffQuotePayload | undefined>()
  const [note, setNote] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null)
  const [sendEmail, setSendEmail] = React.useState(true)
  const [expiresAt, setExpiresAt] = React.useState<string | undefined>(undefined)
  const [error, setError] = React.useState<string | null>(null)

  // read hidden fields from QuoteAndDeliveryCard
  React.useEffect(() => {
    const send = (document.querySelector('input[name="__sendEmail"]') as HTMLInputElement)?.value
    const exp  = (document.querySelector('input[name="__expiresAt"]') as HTMLInputElement)?.value
    setSendEmail(send !== 'false')
    setExpiresAt(exp || undefined)
  })

  async function submit() {
    setError(null)
    if (!designerEmail) { setError('Designer email is required.'); return }
    if (products.length === 0) { setError('Add at least one product.'); return }

    const payload: CreateHandoffRequest = {
      designerEmail,
      products,
      quote,
      note: note || undefined,
      expiresAt,
      sendEmail,
    }

    setSending(true)
    try {
      const res = await fetch('/api/vendor/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      const { visitUrl } = await res.json()
      setInviteUrl(visitUrl)
    } catch (e:any) {
      setError(e.message ?? 'Something went wrong.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Handoff</h1>
        <p className="text-gray-500">Package products & a quote. The designer chooses where it lands.</p>
      </div>

      <RecipientEmailCard value={designerEmail} onChange={setDesignerEmail} />
      <ProductPickerCard items={products} onChange={setProducts} />
      <div className="border rounded-2xl p-6 bg-white">
        <h3 className="text-lg font-semibold mb-2">Optional note</h3>
        <textarea className="w-full border rounded-xl px-3 py-2 h-24" placeholder="Context for the designer (optional)"
          value={note} onChange={e => setNote(e.target.value)} />
      </div>
      <QuoteAndDeliveryCard quote={quote} onChange={setQuote} />

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="px-5 py-3 rounded-2xl bg-black text-white"
        >
          {sending ? 'Creating…' : 'Create Handoff'}
        </button>
        <span className="text-sm text-gray-500">You'll get a private link to share; we can email it too.</span>
      </div>

      {/* Copy Invite Link Modal */}
      {inviteUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Invite Link Created</h3>
            <p className="text-sm text-gray-500 mb-4">
              Share this link with the designer (we'll email it too if email is configured).
            </p>
            <div className="flex gap-2 mb-4">
              <input 
                readOnly 
                value={inviteUrl} 
                className="flex-1 border rounded-xl px-3 py-2 text-sm" 
              />
              <button
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className="px-4 py-2 rounded-xl border hover:bg-gray-50"
              >
                Copy
              </button>
              <button
                onClick={() => window.open(inviteUrl, '_blank')}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                Open
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setInviteUrl(null)}
                className="px-4 py-2 rounded-xl bg-black text-white hover:bg-gray-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
