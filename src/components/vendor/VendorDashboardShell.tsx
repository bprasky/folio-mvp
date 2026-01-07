'use client';

import { DemoStateProvider } from '@/lib/vendor-data/demoState';
import { flags } from '@/lib/flags';
import { VendorDashboardNew } from './VendorDashboardNew';

/**
 * Client wrapper that conditionally provides DemoState when demo mode is active
 */
export function VendorDashboardShell() {
  const isDemoParam = () => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('demo') === '1';
  };

  const demoEnabled = flags.vendorDemoData || isDemoParam();

  const dashboard = <VendorDashboardNew />;

  if (!demoEnabled) {
    return dashboard;
  }

  return (
    <DemoStateProvider>
      {dashboard}
    </DemoStateProvider>
  );
}


