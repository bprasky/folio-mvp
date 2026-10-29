'use client';

import './auth.css';

type SsoRowProps = {
  showGoogle: boolean;
  showApple: boolean;
  onGoogleClick: () => void;
  onAppleClick: () => void;
  disabled?: boolean;
};

export function SsoRow({ showGoogle, showApple, onGoogleClick, onAppleClick, disabled }: SsoRowProps) {
  return (
    <div className="auth-sso">
      {showGoogle && <button
        type="button"
        aria-label="Continue with Google"
        onClick={onGoogleClick}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
        Google
      </button>}
      {showApple && <button
        type="button"
        aria-label="Continue with Apple"
        onClick={onAppleClick}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d="M16.5 12.5c0-2.6 2.1-3.8 2.2-3.9-1.2-1.7-3-1.95-3.7-2-1.6-.16-3.1.94-3.9.94-.8 0-2.05-.92-3.4-.9-1.7.02-3.3 1-4.2 2.55-1.8 3.1-.46 7.7 1.3 10.2.85 1.2 1.85 2.55 3.2 2.5 1.3-.05 1.8-.83 3.35-.83 1.55 0 2 .83 3.35.8 1.4-.02 2.27-1.22 3.12-2.43.98-1.4 1.4-2.75 1.42-2.82-.03-.02-2.72-1.04-2.74-4.13zM14.05 5.4c.7-.86 1.18-2.05 1.05-3.25-1.02.04-2.25.68-2.98 1.53-.65.75-1.22 1.97-1.07 3.13 1.14.1 2.3-.58 3-1.4z" />
        </svg>
        Apple
      </button>}
    </div>
  );
}
