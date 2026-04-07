'use client';

import { useState } from 'react';
import { FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { DirectoryEntry } from '@/types/directory';

interface RepEmailCellProps {
  entry: DirectoryEntry;
  onUpdate: () => void;
}

export default function RepEmailCell({ entry, onUpdate }: RepEmailCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [email, setEmail] = useState(entry.repEmail || '');
  const [name, setName] = useState(entry.repName || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!email.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      setSaving(true);
      
      // TODO: Create API endpoint to update rep email
      // For now, we'll use the VendorInviteContact creation logic
      // This would need to be implemented in a separate endpoint
      
      // Placeholder: In a real implementation, you'd call:
      // await fetch('/api/designer/directory/rep-email', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     productId: entry.productId,
      //     vendorName: entry.productBrand,
      //     repEmail: email,
      //     repName: name,
      //   }),
      // });

      // For now, just show a message
      console.log('Would save rep email:', { email, name, productId: entry.productId });
      
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to save rep email:', error);
      alert('Failed to save rep email');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEmail(entry.repEmail || '');
    setName(entry.repName || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="rep@vendor.com"
          className="px-2 py-1 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary text-sm w-32 focus:outline-none focus:border-folio-border-strong focus:shadow-[0_0_0_3px_rgba(0,0,0,0.03)]"
          autoFocus
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rep Name"
          className="px-2 py-1 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary text-sm w-24 focus:outline-none focus:border-folio-border-strong focus:shadow-[0_0_0_3px_rgba(0,0,0,0.03)]"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-green-400 hover:text-green-300 disabled:opacity-50"
        >
          <FaCheck />
        </button>
        <button
          onClick={handleCancel}
          className="text-red-400 hover:text-red-300"
        >
          <FaTimes />
        </button>
      </div>
    );
  }

  if (entry.repEmail) {
    return (
      <div className="flex items-center gap-2 group">
        <div className="text-sm text-folio-text-secondary">
          <div>{entry.repEmail}</div>
          {entry.repName && (
            <div className="text-xs text-folio-text-tertiary">{entry.repName}</div>
          )}
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="opacity-0 group-hover:opacity-100 text-folio-text-tertiary hover:text-folio-text-secondary transition-opacity"
        >
          <FaEdit className="text-xs" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="text-sm text-folio-text-secondary hover:text-folio-text-secondary flex items-center gap-1 transition-colors"
    >
      <FaEdit className="text-xs" />
      Add rep
    </button>
  );
}

