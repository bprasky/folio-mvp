'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface EmailPreferences {
  emailSendPreference: string | null;
  signatureIncludeFirm: boolean;
  signatureIncludePhone: boolean;
  signatureIncludeProfile: boolean;
  signatureIncludeEmail: boolean;
  proxyAddress: string;
}

export default function EmailPreferencesPage() {
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/email-preferences')
      .then(res => res.json())
      .then(data => { setPrefs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    setSaved(false);

    await fetch('/api/settings/email-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailSendPreference: prefs.emailSendPreference,
        signatureIncludeFirm: prefs.signatureIncludeFirm,
        signatureIncludePhone: prefs.signatureIncludePhone,
        signatureIncludeProfile: prefs.signatureIncludeProfile,
        signatureIncludeEmail: prefs.signatureIncludeEmail,
      }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyProxy = () => {
    if (prefs?.proxyAddress) {
      navigator.clipboard.writeText(prefs.proxyAddress);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] p-6">
        <div className="max-w-xl mx-auto">
          <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: '#E8E4DF' }} />
        </div>
      </div>
    );
  }

  if (!prefs) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-xl mx-auto">
        <h1 className="folio-h1 text-[var(--text-primary)] mb-6">Email Preferences</h1>

        <div className="glass-surface rounded-xl p-6 space-y-6">
          {/* Send preference */}
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
              When sending action item emails:
            </h3>
            <div className="space-y-2">
              {[
                { value: 'folio', label: 'Send from Folio (replies come back to Folio)' },
                { value: 'mailto', label: 'Open in my mail client' },
                { value: 'ask', label: 'Ask me each time' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="sendPref"
                    checked={prefs.emailSendPreference === opt.value}
                    onChange={() => setPrefs({ ...prefs, emailSendPreference: opt.value })}
                    className="text-[#2C2825] focus:ring-[var(--accent)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Proxy address */}
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">
              Your Folio email address
            </h3>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-[#F0EDE9] rounded-lg px-3 py-2 text-[var(--text-secondary)] flex-1">
                {prefs.proxyAddress}
              </code>
              <button
                onClick={copyProxy}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Replies to this address appear in your Folio inbox.
            </p>
          </div>

          {/* Signature options */}
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
              Email signature
            </h3>
            <div className="space-y-2">
              {[
                { key: 'signatureIncludeFirm', label: 'Include my firm name' },
                { key: 'signatureIncludePhone', label: 'Include my phone number' },
                { key: 'signatureIncludeProfile', label: 'Include my Folio profile link' },
                { key: 'signatureIncludeEmail', label: 'Include my personal email address' },
              ].map(opt => (
                <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs[opt.key as keyof EmailPreferences] as boolean}
                    onChange={(e) => setPrefs({ ...prefs, [opt.key]: e.target.checked })}
                    className="rounded border-[#C9C4BC] text-[#2C2825] focus:ring-[var(--accent)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="accent" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
            {saved && (
              <span className="text-sm text-green-600">Saved</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
