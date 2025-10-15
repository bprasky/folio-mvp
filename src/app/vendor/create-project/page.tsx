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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Only vendors can create projects</p>
          <p className="text-sm text-gray-500 mt-2">
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
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Vendor Context Header */}
      {vendorCtx && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-900">Sending as:</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
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