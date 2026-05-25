'use client';

import { useMemo } from 'react';
import './auth.css';

const LEVELS = ['—', 'Weak', 'Fair', 'Strong', 'Excellent'] as const;

function scorePassword(v: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/\d/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v) && v.length >= 12) score++;
  return score as 0 | 1 | 2 | 3 | 4;
}

type PasswordStrengthMeterProps = {
  password: string;
};

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const score = useMemo(() => scorePassword(password), [password]);
  return (
    <div className={`auth-strength auth-strength--s${score}`} aria-hidden="true">
      <div className="auth-strength__track">
        <span className="auth-strength__seg" />
        <span className="auth-strength__seg" />
        <span className="auth-strength__seg" />
        <span className="auth-strength__seg" />
      </div>
      <div className="auth-strength__label">
        <span>Password strength</span>
        <span className="auth-strength__level">{LEVELS[score]}</span>
      </div>
    </div>
  );
}
