'use client';

import { useState, useEffect, useCallback } from 'react';
import SafeImage from '@/components/SafeImage';
import { GlassModal, GlassModalBody } from '@/components/ui/glass-modal';
import type { UpcomingEventRSVP } from '@/app/designer/profile/types';

interface FolioBadgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    name: string;
    title: string | null;
    profileImage: string | null;
  };
  organization: { name: string } | null;
  tagline: string | null;
  monographUrl: string;
  upcomingEventRSVPs: UpcomingEventRSVP[];
}

export default function FolioBadgeModal({
  open,
  onOpenChange,
  user,
  organization,
  tagline,
  monographUrl,
  upcomingEventRSVPs,
}: FolioBadgeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const nearestEvent = upcomingEventRSVPs[0] ?? null;

  // Build the full QR target URL — always includes ?badge=true so scanning enables connect flow
  const buildBadgeUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${monographUrl}`;
    if (nearestEvent) {
      return `${base}?badge=true&event=${nearestEvent.eventId}`;
    }
    return `${base}?badge=true`;
  }, [monographUrl, nearestEvent]);

  // Generate QR code client-side (code-split)
  useEffect(() => {
    if (!open) return;
    const url = buildBadgeUrl();
    if (!url) return;

    import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(url, {
          width: 240,
          margin: 2,
          color: {
            dark: '#2C2825',
            light: '#FAF9F7',
          },
        })
      )
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [open, buildBadgeUrl]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `folio-badge-${user.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handleCopyLink = async () => {
    const url = buildBadgeUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const initials = user.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const truncatedTagline = tagline
    ? tagline.length > 100
      ? tagline.slice(0, 97) + '...'
      : tagline
    : null;

  const formatEventDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <GlassModal open={open} onOpenChange={onOpenChange} size="sm">
      <GlassModalBody className="px-6 md:px-8 py-8">
        {/* Mini profile intro */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            {user.profileImage ? (
              <SafeImage
                src={user.profileImage}
                alt={user.name}
                width={56}
                height={56}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-surface-ground"
                style={{
                  background: 'linear-gradient(135deg, #5C554D 0%, #8B8178 100%)',
                  fontSize: '18px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                {initials}
              </div>
            )}
          </div>

          <h3
            className="text-folio-text-primary"
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '20px',
              fontWeight: 400,
              margin: '0 0 4px',
            }}
          >
            {user.name}
          </h3>

          {(user.title || organization) && (
            <p
              className="text-folio-text-secondary"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                margin: '0 0 8px',
              }}
            >
              {user.title && organization
                ? `${user.title} at ${organization.name}`
                : user.title || organization?.name}
            </p>
          )}

          {truncatedTagline && (
            <p
              className="text-folio-text-tertiary"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                lineHeight: 1.5,
                margin: 0,
                fontStyle: 'italic',
              }}
            >
              &ldquo;{truncatedTagline}&rdquo;
            </p>
          )}
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-5">
          {qrDataUrl ? (
            <div
              className="rounded-2xl overflow-hidden border border-folio-border-subtle bg-surface-ground"
              style={{
                padding: '16px',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Folio Badge QR Code"
                width={240}
                height={240}
                style={{ display: 'block' }}
              />
            </div>
          ) : (
            <div
              className="rounded-2xl animate-pulse"
              style={{
                width: 272,
                height: 272,
                background: '#F0EDE9',
              }}
            />
          )}
        </div>

        {/* Event context */}
        {nearestEvent && (
          <div
            className="text-center mb-5"
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              background: '#F0EDE9',
            }}
          >
            <p
              className="text-folio-text-secondary"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                margin: 0,
              }}
            >
              <span style={{ fontWeight: 600 }}>Badge for:</span>{' '}
              {nearestEvent.eventTitle}
              {' · '}
              {formatEventDate(nearestEvent.eventStartDate)}
              {nearestEvent.eventLocation && (
                <span className="text-folio-text-secondary"> · {nearestEvent.eventLocation}</span>
              )}
            </p>
            {upcomingEventRSVPs.length > 1 && (
              <p
                className="text-folio-text-tertiary"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  margin: '4px 0 0',
                }}
              >
                + {upcomingEventRSVPs.length - 1} more upcoming event
                {upcomingEventRSVPs.length - 1 > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="px-5 py-2.5 rounded-full text-[13px] font-medium text-white transition-colors disabled:opacity-40 bg-folio-text-primary"
          >
            Save Badge
          </button>
          <button
            onClick={handleCopyLink}
            className="px-5 py-2.5 rounded-full text-[13px] font-medium border transition-colors border-folio-border-subtle text-folio-text-secondary"
            style={{
              backgroundColor: copied ? '#F0EDE9' : 'transparent',
            }}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </GlassModalBody>
    </GlassModal>
  );
}
