'use client';

import { Mic } from 'lucide-react';

export type FieldDisplayState =
  | 'interview-extracted'    // Populated from interview, not yet touched
  | 'interview-then-edited'  // Extracted then user modified
  | 'manually-entered'       // No interview; user typed it
  | 'empty-no-interview'     // No interview, no manual entry
  | 'empty-post-interview';  // Interview done but field not extracted

interface ProfileFieldProps {
  label: string;
  fieldName: string;
  value: string;
  displayState: FieldDisplayState;
  multiline?: boolean;
  onChange: (fieldName: string, value: string) => void;
  onInterviewRoute?: () => void;
}

export function ProfileField({
  label,
  fieldName,
  value,
  displayState,
  multiline = false,
  onChange,
  onInterviewRoute,
}: ProfileFieldProps) {
  if (displayState === 'empty-no-interview') {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: '#E8E4DF', backgroundColor: 'var(--surface-ground)' }}
      >
        <p className="text-sm mb-2" style={{ color: '#8B8178' }}>{label}</p>
        <button
          onClick={onInterviewRoute}
          className="text-sm underline underline-offset-2 transition-opacity hover:opacity-70"
          style={{ color: 'var(--folio-gold)' }}
        >
          Answer a few questions to complete this &rarr;
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label
          className="text-xs font-medium"
          style={{ color: '#6B635B', fontFamily: 'var(--font-body)' }}
        >
          {label}
        </label>
        {displayState === 'interview-extracted' && (
          <span
            className="text-xs italic flex items-center gap-1"
            style={{ color: '#B8B0A6' }}
          >
            <Mic size={10} />
            From your interview
          </span>
        )}
        {displayState === 'interview-then-edited' && (
          <span className="text-xs italic" style={{ color: '#B8B0A6' }}>
            Edited
          </span>
        )}
        {displayState === 'empty-post-interview' && (
          <span className="text-xs italic" style={{ color: '#B8B0A6' }}>
            Not captured — edit below
          </span>
        )}
      </div>

      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(fieldName, e.target.value)}
          className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[var(--folio-gold)] resize-none"
          style={{
            borderColor: '#E8E4DF',
            backgroundColor: 'var(--surface-ground)',
            color: '#2C2825',
            fontFamily: 'var(--font-body)',
          }}
          rows={fieldName === 'bio' || fieldName === 'description' ? 5 : 3}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(fieldName, e.target.value)}
          className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[var(--folio-gold)]"
          style={{
            borderColor: '#E8E4DF',
            backgroundColor: 'var(--surface-ground)',
            color: '#2C2825',
            fontFamily: 'var(--font-body)',
          }}
        />
      )}
    </div>
  );
}

/**
 * Determine the display state for a field based on its source and value.
 */
export function getFieldDisplayState(
  fieldValue: string | undefined | null,
  fieldSource: { source: string } | undefined,
  interviewCompleted: boolean
): FieldDisplayState {
  if (!fieldSource) {
    if (!fieldValue && !interviewCompleted) return 'empty-no-interview';
    if (!fieldValue && interviewCompleted) return 'empty-post-interview';
    return 'manually-entered';
  }

  switch (fieldSource.source) {
    case 'INTERVIEW_EXTRACTED':
      return 'interview-extracted';
    case 'INTERVIEW_THEN_EDITED':
      return 'interview-then-edited';
    case 'MANUALLY_ENTERED':
      return 'manually-entered';
    default:
      return 'manually-entered';
  }
}
