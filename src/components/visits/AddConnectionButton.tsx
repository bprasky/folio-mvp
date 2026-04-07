'use client';

import { useState } from 'react';
import RemoteConnectModal from './RemoteConnectModal';

export default function AddConnectionButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-full text-sm font-medium border border-folio-border-subtle text-folio-text-secondary transition-colors hover:bg-surface-ground"
      >
        + Add Connection
      </button>

      <RemoteConnectModal open={open} onOpenChange={setOpen} />
    </>
  );
}
