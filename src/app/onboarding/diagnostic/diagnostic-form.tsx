'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { RoleCard } from '@/components/onboarding/RoleCard';

type DiagnosticRole = 'DESIGNER' | 'ARCHITECT' | 'BUILDER' | 'INDIVIDUAL';

const ROLE_OPTIONS: Array<{
  value: DiagnosticRole;
  label: string;
  description: string;
}> = [
  {
    value: 'DESIGNER',
    label: 'Designer',
    description: 'Interior designer publishing completed projects.',
  },
  {
    value: 'ARCHITECT',
    label: 'Architect',
    description: 'Architect contributing built work and credits.',
  },
  {
    value: 'BUILDER',
    label: 'Builder',
    description: 'Builder or contractor tagged on completed projects.',
  },
  {
    value: 'INDIVIDUAL',
    label: "I'm here to explore",
    description: 'Browse, save, and follow without publishing.',
  },
];

interface DiagnosticFormProps {
  initialSelection: DiagnosticRole | null;
}

export function DiagnosticForm({ initialSelection }: DiagnosticFormProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [selected, setSelected] = useState<DiagnosticRole | null>(initialSelection);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not save your selection');
      }
      const data = await res.json();
      // Refresh JWT so middleware sees the new role + timestamp.
      await updateSession();
      router.replace(data.nextPath ?? '/onboarding/firm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ROLE_OPTIONS.map((opt) => (
          <RoleCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={selected === opt.value}
            onSelect={() => setSelected(opt.value)}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-center pt-2">
        <Button
          variant="accent"
          size="lg"
          onClick={handleContinue}
          disabled={!selected || submitting}
          className="min-w-[200px]"
        >
          {submitting ? 'Saving…' : 'Continue →'}
        </Button>
      </div>
    </div>
  );
}
