'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ShareButtonsProps {
  articleUrl: string;
  articleTitle: string;
  shareCardUrl?: string;
  onShare?: (platform: string) => void;
}

export function ShareButtons({
  articleUrl,
  articleTitle,
  shareCardUrl,
  onShare,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(articleUrl);
      setCopied(true);
      onShare?.('copy');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownload = async () => {
    if (!shareCardUrl) return;

    setDownloading(true);
    try {
      // For SVG data URLs, we need to convert to a downloadable format
      const response = await fetch(shareCardUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'folio-share-card.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      onShare?.('download');
    } catch (error) {
      console.error('Failed to download:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleLinkedIn = () => {
    const url = encodeURIComponent(articleUrl);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      '_blank',
      'width=600,height=600'
    );
    onShare?.('linkedin');
  };

  const handleTwitter = () => {
    const text = encodeURIComponent(`Check out my contribution: "${articleTitle}"`);
    const url = encodeURIComponent(articleUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      '_blank',
      'width=600,height=400'
    );
    onShare?.('twitter');
  };

  return (
    <div className="space-y-3">
      {/* Primary actions */}
      <div className="flex gap-3">
        <Button
          variant="ridge"
          onClick={handleCopyLink}
          className="flex-1"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Link
            </>
          )}
        </Button>

        {shareCardUrl && (
          <Button
            variant="ridge"
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? 'Downloading...' : 'Download Image'}
          </Button>
        )}
      </div>

      {/* Social platforms */}
      <div className="flex gap-3">
        <button
          onClick={handleLinkedIn}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg',
            'bg-[#0A66C2] text-white hover:bg-[#004182] transition-colors'
          )}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          LinkedIn
        </button>

        <button
          onClick={handleTwitter}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg',
            'bg-black text-white hover:bg-gray-800 transition-colors'
          )}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X / Twitter
        </button>
      </div>

      {/* Instagram instructions */}
      <div className="text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          For Instagram, download the image and share from your phone.
        </p>
      </div>
    </div>
  );
}
