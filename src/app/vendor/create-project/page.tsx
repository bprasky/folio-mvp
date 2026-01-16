import { getFeatureFlag } from '@/lib/flags'
import VendorProjectCreator from '@/components/VendorProjectCreator'
import dynamic from 'next/dynamic'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getVendorContext } from '@/lib/auth/vendorContext'

const HandoffComposer = dynamic(() => import('@/components/vendor/handoff/HandoffComposer'), { ssr: false })

interface CreateProjectPageProps {
  searchParams: { mode?: string }
}

export default async function VendorCreateProjectPage({ searchParams }: CreateProjectPageProps) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  if (session.user.role !== 'VENDOR') {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="text-center">
          <p className="folio-body text-[var(--text-secondary)]">Only vendors can create projects</p>
          <p className="folio-meta mt-2">
            Current role: {session.user.role}
          </p>
        </div>
      </div>
    )
  }

  // Get vendor context from session
  const vendorCtx = await getVendorContext()
  
  const handoffEnabled = getFeatureFlag('FEATURE_VENDOR_HANDOFF', false)
  const mode = searchParams?.mode

  const showHandoff = handoffEnabled && mode === 'handoff'

  if (!handoffEnabled && mode === 'handoff') {
    console.warn('[FOLIO] FEATURE_VENDOR_HANDOFF not enabled — showing ProjectCreator instead.')
  }
  
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 bg-[var(--bg-base)] min-h-screen">
      {/* Vendor Context Header */}
      {vendorCtx && (
        <div className="ridge-card p-4">
          <div className="flex items-center gap-2">
            <span className="folio-body font-medium text-[var(--text-primary)]">Sending as:</span>
            <span className="px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full text-sm">
              {vendorCtx.vendor.name}
            </span>
          </div>
        </div>
      )}

      {showHandoff ? (
        <HandoffComposer vendorCtx={vendorCtx} />
      ) : (
        <VendorProjectCreator
          vendorUserId={session.user.id}
          vendorOrgId={vendorCtx?.vendorOrgId || ""}
        />
      )}
    </div>
  )
} 