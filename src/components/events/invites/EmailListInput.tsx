"use client";

import { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';

interface EmailListInputProps {
  eventId: string;
  onSuccess?: (count: number) => void;
}

export default function EmailListInput({ eventId, onSuccess }: EmailListInputProps) {
  const [emails, setEmails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);

  const handleSubmit = async () => {
    if (!emails.trim()) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('emails', emails);
      formData.append('source', 'email');

      const response = await fetch(`/api/events/${eventId}/invites/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, count: data.created });
        onSuccess?.(data.created);
        setEmails('');
      } else {
        setResult({ success: false, error: data.error || 'Upload failed' });
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message || 'Upload failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailCount = emails.split(/[,\n]/).filter((e) => e.trim().includes('@')).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-ink mb-2">Enter Email Addresses</h3>
        <p className="text-sm text-folio-text-tertiary mb-4">
          Enter email addresses separated by commas or new lines
        </p>
      </div>

      <div className="relative">
        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="email1@example.com, email2@example.com&#10;email3@example.com"
          className="w-full h-32 px-4 py-3 border border-folio-border-strong rounded-lg focus:ring-2 focus:ring-accent-400 focus:border-accent-400 resize-none"
        />
        <div className="absolute bottom-2 right-2 text-xs text-folio-text-tertiary">
          {emailCount} email{emailCount !== 1 ? 's' : ''}
        </div>
      </div>

      {result && (
        <div
          className={`p-4 rounded-lg flex items-start space-x-3 ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            {result.success ? (
              <p className="text-sm text-green-800">
                Successfully added {result.count} contacts
              </p>
            ) : (
              <p className="text-sm text-red-800">{result.error}</p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!emails.trim() || isSubmitting}
        className="w-full px-4 py-2 bg-ink text-white rounded-lg font-medium hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Adding Contacts...' : 'Add Contacts'}
      </button>
    </div>
  );
}




