'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import './auth.css';

type AuthFormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: ReactNode;
  helperRight?: ReactNode;
};

export const AuthFormField = forwardRef<HTMLInputElement, AuthFormFieldProps>(
  function AuthFormField({ id, label, helperRight, className, ...inputProps }, ref) {
    return (
      <div className="auth-field">
        <div className="auth-field__head">
          <label htmlFor={id} className="auth-field__label">
            {label}
          </label>
          {helperRight ? <span className="auth-field__helper">{helperRight}</span> : null}
        </div>
        <input
          ref={ref}
          id={id}
          className={`auth-field__input${className ? ` ${className}` : ''}`}
          {...inputProps}
        />
      </div>
    );
  }
);
