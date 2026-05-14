'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { trackModal } from '@/lib/telemetry';

const SESSION_KEY = 'folio_welcome_dismissed';
const MAX_FRAME_KEY = 'folio_modal_max_frame_seen';

type FrameIndex = 1 | 2 | 3;

const frames: Array<{
  videoBase: string;
  headline: string;
  body: string;
}> = [
  {
    videoBase: '/onboarding/01-published-project',
    headline: 'Your living, breathing portfolio',
    body: 'Every project becomes a story worth telling. Upload your work and walk through an interview that goes deeper than any reporter would. The story you worked so hard to create, finally told the way you would tell it.',
  },
  {
    videoBase: '/onboarding/02-interview-moment',
    headline: "Folio asks questions a reporter can't",
    body: 'Every project starts with an interview that goes deeper than any journalist would. Your answers become editorial in your voice, under your name. You talk, Folio writes.',
  },
  {
    videoBase: '/onboarding/03-sourcebook-fills',
    headline: 'Your Sourcebook fills itself',
    body: "Every product you tag while publishing becomes part of your Sourcebook. Search, filter, and reference everything you've ever speced. Your past work becomes the reference library for your next project.",
  },
];

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<FrameIndex>(1);
  const [maxFrameSeen, setMaxFrameSeen] = useState<FrameIndex>(1);
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') return;
    if (status === 'loading') return;
    if (!sessionStorage.getItem(SESSION_KEY)) {
      setIsOpen(true);
    }
  }, [status]);

  useEffect(() => {
    if (!isOpen) return;
    trackModal({ name: 'modal_frame_viewed', frame: currentFrame });
    setMaxFrameSeen((prev) => {
      const next = (currentFrame > prev ? currentFrame : prev) as FrameIndex;
      sessionStorage.setItem(MAX_FRAME_KEY, String(next));
      return next;
    });
  }, [isOpen, currentFrame]);

  const closeAndDismiss = useCallback(
    (viaCta: boolean) => {
      sessionStorage.setItem(SESSION_KEY, 'true');
      if (viaCta) {
        trackModal({
          name: 'modal_cta_clicked',
          max_frame_reached: 3,
          via_cta: true,
        });
      } else {
        trackModal({
          name: 'modal_dismissed',
          max_frame_reached: maxFrameSeen,
          via_cta: false,
        });
      }
      setIsOpen(false);
    },
    [maxFrameSeen]
  );

  const goNext = useCallback(() => {
    if (currentFrame === 3) {
      closeAndDismiss(true);
      return;
    }
    setCurrentFrame((prev) => (prev + 1) as FrameIndex);
  }, [currentFrame, closeAndDismiss]);

  const goBack = useCallback(() => {
    if (currentFrame === 1) return;
    const from = currentFrame as 2 | 3;
    const to = (currentFrame - 1) as 1 | 2;
    trackModal({ name: 'modal_frame_back', from_frame: from, to_frame: to });
    setCurrentFrame(to);
  }, [currentFrame]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeAndDismiss(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, goNext, goBack, closeAndDismiss]);

  const activeFrame = frames[currentFrame - 1];
  const isLast = currentFrame === 3;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="welcome-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center glass-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => closeAndDismiss(false)}
        >
          <motion.div
            className="relative w-[92%] max-w-[620px] max-h-[92vh] flex flex-col glass-overlay rounded-[20px] overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-7 py-4 shrink-0"
              style={{ borderBottom: '1px solid rgba(201, 169, 110, 0.12)' }}
            >
              <span className="font-headline text-xl tracking-wide font-semibold text-folio-text-primary">
                FOLIO
              </span>
              <button
                onClick={() => closeAndDismiss(false)}
                className="p-2 -mr-2 rounded-full hover:bg-black/5 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-[#7a6e68]" />
              </button>
            </div>

            {/* Frame body */}
            <div className="relative">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentFrame}
                  className="flex flex-col px-7 pt-6 pb-6"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <FrameVideo
                    key={`video-${currentFrame}`}
                    videoBase={activeFrame.videoBase}
                  />
                  <h2 className="font-headline italic text-3xl text-folio-text-primary leading-[var(--lh-h2)] mt-6">
                    {activeFrame.headline}
                  </h2>
                  <p
                    className="mt-3 text-sm leading-relaxed"
                    style={{ color: 'rgba(40, 30, 24, 0.75)' }}
                  >
                    {activeFrame.body}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between gap-3 px-7 py-4 shrink-0"
              style={{ borderTop: '1px solid rgba(201, 169, 110, 0.12)' }}
            >
              <div className="flex items-center gap-3">
                <FrameDots current={currentFrame} />
                {currentFrame > 1 && (
                  <button
                    onClick={goBack}
                    className="text-xs hover:text-folio-text-primary transition-colors"
                    style={{ color: 'rgba(40, 30, 24, 0.6)' }}
                    aria-label="Previous frame"
                  >
                    &larr; Back
                  </button>
                )}
              </div>
              {isLast ? (
                <Link
                  href="/auth/signup"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeAndDismiss(true);
                  }}
                  className="accent-btn inline-block px-7 py-2.5 text-sm"
                >
                  Get Started
                </Link>
              ) : (
                <button
                  onClick={goNext}
                  className="accent-btn inline-block px-7 py-2.5 text-sm"
                >
                  Next &rarr;
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FrameVideo({ videoBase }: { videoBase: string }) {
  const [videoError, setVideoError] = useState(false);

  if (videoError) {
    return <div className="w-full aspect-[16/10] rounded-xl warm-mesh" />;
  }

  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      onError={() => setVideoError(true)}
      className="w-full aspect-[16/10] object-cover rounded-xl"
      src={`${videoBase}.mp4`}
    />
  );
}

function FrameDots({ current }: { current: FrameIndex }) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="presentation"
      aria-label={`Frame ${current} of 3`}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full transition-colors"
          style={{
            backgroundColor: i === current ? '#C9A96E' : 'transparent',
            border: i === current ? 'none' : '1px solid rgba(201, 169, 110, 0.5)',
          }}
        />
      ))}
    </div>
  );
}
