'use client';

import { useState } from 'react';
import RemoteConnectModal from './RemoteConnectModal';

export default function AddConnectionButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-full text-sm font-medium border transition-colors hover:bg-surface-ground"
        style={{ borderColor: '#E8E4DF', color: '#5C554D' }}
      >
        + Add Connection
      </button>

      <RemoteConnectModal open={open} onOpenChange={setOpen} />
    </>
  );
}
