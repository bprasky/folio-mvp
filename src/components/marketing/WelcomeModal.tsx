'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, X } from 'lucide-react';
import { trackModal } from '@/lib/telemetry';
import styles from './WelcomeModal.module.css';

const SESSION_KEY = 'folio_welcome_dismissed';
// Also remember dismissal across client remounts when browser storage is blocked.
let dismissedInMemory = false;

// Reuse Folio's existing login photography; this is brand imagery, not a project credit.
const WELCOME_IMAGE =
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=85&w=1600&auto=format&fit=crop';

export function WelcomeModal() {
  const { status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const hasViewed = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const signupLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (status !== 'unauthenticated' || dismissedInMemory) {
      setIsOpen(false);
      return;
    }

    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // The welcome remains usable in browsers that deny storage access.
    }

    previousFocus.current = document.activeElement as HTMLElement | null;
    setIsOpen(true);
  }, [status]);

  useEffect(() => {
    if (!isOpen || hasViewed.current) return;
    hasViewed.current = true;
    trackModal({ name: 'modal_frame_viewed', frame: 1 });
  }, [isOpen]);

  function dismiss(viaCta: boolean) {
    dismissedInMemory = true;
    setIsOpen(false);
    try {
      sessionStorage.setItem(SESSION_KEY, 'true');
    } catch {
      // The in-memory dismissal still works for this visit.
    }
    if (viaCta) {
      trackModal({ name: 'modal_cta_clicked', max_frame_reached: 1, via_cta: true });
    } else {
      trackModal({ name: 'modal_dismissed', max_frame_reached: 1, via_cta: false });
    }
  }

  return (
    <Dialog.Root
      open={isOpen && status === 'unauthenticated'}
      onOpenChange={(open) => { if (!open) dismiss(false); }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.backdrop} />
        <Dialog.Content
          className={styles.panel}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            signupLink.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (previousFocus.current?.isConnected) previousFocus.current.focus();
          }}
        >
          <div className={styles.cover}>
            {!imageFailed && (
              <Image
                src={WELCOME_IMAGE}
                alt=""
                fill
                priority
                sizes="(max-width: 992px) calc(100vw - 32px), 960px"
                className={styles.photograph}
                onError={() => setImageFailed(true)}
              />
            )}
            <div className={styles.scrim} aria-hidden="true" />
            <div className={styles.copy}>
              <Dialog.Title className={styles.title}>
                Folio is your<br />
                studio’s magazine.
              </Dialog.Title>
              <Dialog.Description className={styles.description}>
                Your projects tell people what you create. The stories behind them reveal how you think. Folio brings both together in a publication of your own.
              </Dialog.Description>
              <div className={styles.actions}>
                <Link
                  ref={signupLink}
                  href="/auth/signup"
                  className={styles.signup}
                  onClick={() => dismiss(true)}
                >
                  Sign up <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="/auth/signin"
                  className={styles.signin}
                  onClick={() => dismiss(true)}
                >
                  Sign in
                </Link>
              </div>
              <button
                type="button"
                className={styles.explore}
                onClick={() => dismiss(true)}
              >
                Explore Folio
              </button>
            </div>
            <Dialog.Close className={styles.close} aria-label="Close welcome" type="button">
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
