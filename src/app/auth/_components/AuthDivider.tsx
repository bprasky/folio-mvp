import './auth.css';

type AuthDividerProps = {
  label?: string;
};

export function AuthDivider({ label = 'or with email' }: AuthDividerProps) {
  return (
    <div className="auth-divider" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}
