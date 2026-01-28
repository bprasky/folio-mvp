'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  RidgeCard,
  RidgeCardHeader,
  RidgeCardTitle,
  RidgeCardContent,
} from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface VendorVisibilityState {
  enabled: boolean;
  enabledAt: string | null;
}

export default function PrivacySettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [visibility, setVisibility] = useState<VendorVisibilityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/settings/privacy');
      return;
    }

    if (status === 'authenticated') {
      fetchVendorVisibility();
    }
  }, [status, router]);

  async function fetchVendorVisibility() {
    try {
      const response = await fetch('/api/designer/settings/vendor-visibility');
      if (!response.ok) {
        throw new Error('Failed to fetch vendor visibility setting');
      }
      const data = await response.json();
      setVisibility(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function updateVendorVisibility(enabled: boolean) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/designer/settings/vendor-visibility', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update vendor visibility setting');
      }

      const data = await response.json();
      setVisibility(data);
      setShowConfirmDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  function handleToggleClick() {
    if (!visibility?.enabled) {
      // Show confirmation dialog before enabling
      setShowConfirmDialog(true);
    } else {
      // Disable without confirmation
      updateVendorVisibility(false);
    }
  }

  function handleConfirmEnable() {
    updateVendorVisibility(true);
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-elevated)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
      </div>
    );
  }

  if (error && !visibility) {
    return (
      <div className="min-h-screen bg-[var(--bg-elevated)] p-8">
        <div className="max-w-2xl mx-auto">
          <RidgeCard>
            <RidgeCardContent className="p-6">
              <p className="text-red-500">{error}</p>
              <Button variant="ridge" className="mt-4" onClick={() => fetchVendorVisibility()}>
                Retry
              </Button>
            </RidgeCardContent>
          </RidgeCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-elevated)]">
      <div className="max-w-2xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Privacy Settings</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Control how your information is shared with vendors
          </p>
        </div>

        {/* Vendor Visibility Toggle */}
        <RidgeCard>
          <RidgeCardHeader>
            <RidgeCardTitle>Vendor Visibility</RidgeCardTitle>
          </RidgeCardHeader>
          <RidgeCardContent className="p-6">
            <div className="flex items-start gap-4">
              {/* Toggle Switch */}
              <button
                onClick={handleToggleClick}
                disabled={saving}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full
                  transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2
                  ${visibility?.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-inset)]'}
                  ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                role="switch"
                aria-checked={visibility?.enabled}
                aria-label="Vendor Visibility"
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform
                    ${visibility?.enabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>

              {/* Description */}
              <div className="flex-1">
                <p className="text-[var(--text-primary)] text-sm leading-relaxed">
                  Let vendors see when you&apos;re specifying their products. This unlocks appreciation
                  events, priority samples, and rep support—but means vendors can reach out about
                  your active projects.
                </p>

                {/* Status indicator */}
                {visibility?.enabled && visibility.enabledAt && (
                  <p className="text-[var(--text-tertiary)] text-xs mt-2">
                    Enabled {formatDate(visibility.enabledAt)}
                  </p>
                )}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-red-500 text-sm mt-4">{error}</p>
            )}
          </RidgeCardContent>
        </RidgeCard>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader className="space-y-3">
              <DialogTitle>Enable Vendor Visibility?</DialogTitle>
              <DialogDescription className="text-[var(--text-secondary)] leading-relaxed">
                When enabled, vendors can see when you&apos;re actively specifying their products.
                They may reach out with samples, pricing, and event invitations. You can turn this
                off anytime.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 p-6 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowConfirmDialog(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                onClick={handleConfirmEnable}
                disabled={saving}
              >
                {saving ? 'Enabling...' : 'Enable'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
