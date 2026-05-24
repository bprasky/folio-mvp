'use client';

import type { ReactNode } from 'react';
import './auth.css';

type AgreementCheckboxProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
};

export function AgreementCheckbox({ id, checked, onChange, children }: AgreementCheckboxProps) {
  return (
    <label htmlFor={id} className="auth-agree">
      <input
        id={id}
        type="checkbox"
        className="auth-agree__box"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
