'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { projectEntryHref, professionalEntryHref } from '@/lib/onboarding/professional-entry';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Settings2, ChevronDown, X, ArrowRight } from 'lucide-react';
import { CreateProjectGuide } from '@/components/interviews/CreateProjectGuide';
import { COMPLETION_MONTHS, completionDateInputError } from '@/lib/projects/completionDate';

type Visibility = 'private' | 'unlisted' | 'public';

type FormValues = {
  title: string;
  description: string;
  projectType: string;
  discipline: string;
  location: string;
  year: string;
  month: string;
  tags: string[];
  visibility: Visibility;
};

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 280;
const TAG_LIMIT = 6;

// UI tokens. The three surface levels and the two accents below map 1:1 onto
// globals.css and reference it directly; the remaining entries are editorial
// spec colors that genuinely have no global token yet.
const C = {
  canvas: 'var(--surface-canvas)',
  ground: 'var(--surface-ground)',
  elevated: 'var(--surface-elevated)',
  borderSubtle: '#E8E4DF',
  borderStrong: '#D4CFC8',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  copper: 'var(--folio-copper)',
  copperHover: '#A67548',
  gold: 'var(--folio-gold-ornament)',
  cognac: '#724A31',
  selectedTint: '#FBF6F0',
};

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const TRANSITION = `150ms ${EASE}`;

const PROJECT_TYPES = [
  'Residential',
  'Hospitality',
  'Commercial',
  'Retail',
  'Editorial',
  'Set',
];

const DISCIPLINES = [
  'Full interior',
  'Furniture & FF&E',
  'Renovation',
  'Styling',
];

// Map UI labels to the Prisma ProjectType enum that the API accepts.
const PROJECT_TYPE_TO_ENUM: Record<string, string> = {
  Residential: 'RESIDENTIAL',
  Hospitality: 'HOSPITALITY',
  Commercial: 'COMMERCIAL',
  Retail: 'RETAIL',
  Editorial: 'OTHER',
  Set: 'OTHER',
};

function initialsFromName(name?: string | null): string {
  if (!name) return 'F';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'F';
}

export default function CreateProjectPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [verifiedWorkspace, setVerifiedWorkspace] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    let cancelled = false;
    const callback = window.location.pathname + window.location.search;
    const user = session?.user;
    if (!user?.operatingAsOrgId) {
      router.replace(projectEntryHref(user, callback));
      return;
    }
    // Session workspace IDs can outlive a removed membership. Check current state
    // before showing the form; the create API remains the authorization boundary.
    fetch('/api/user/workspace-context').then(async response => {
      if (!response.ok) throw new Error('Workspace unavailable');
      const data = await response.json();
      const membership = data.organizations?.find((org: { id: string; userRole: string }) => org.id === user.operatingAsOrgId && org.userRole !== 'VIEWER');
      if (cancelled) return;
      if (membership && data.operatingAsOrgId === user.operatingAsOrgId) setVerifiedWorkspace(user.operatingAsOrgId);
      else router.replace(professionalEntryHref(true, 'designer', callback));
    }).catch(() => {
      if (!cancelled) router.replace(professionalEntryHref(true, 'designer', callback));
    });
    return () => { cancelled = true; };
  }, [sessionStatus, session?.user?.id, session?.user?.operatingAsOrgId, router]);
  const operatingAsOrgId =
    ((session?.user as any)?.operatingAsOrgId as string | null | undefined) ?? null;
  const operatingAsOrgName =
    ((session?.user as any)?.operatingAsOrg?.name as string | null | undefined) ??
    ((session?.user as any)?.name as string | null | undefined) ??
    'Your workspace';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setFocus,
    setError,
    clearErrors,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      projectType: '',
      discipline: '',
      location: '',
      year: '',
      month: '',
      tags: [],
      visibility: 'private',
    },
  });

  const title = watch('title');
  const description = watch('description');
  const year = watch('year');
  const month = watch('month');
  const tags = watch('tags');

  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const buildPayload = useCallback(
    (overrideStatus?: 'draft') => {
      const v = getValues();
      // The project is completed even while its Folio entry is saved as a draft.
      const projectStatus: 'new_project' | 'completed_project' =
        overrideStatus === 'draft' ? 'new_project' : 'completed_project';

      return {
        title: v.title.trim(),
        description: v.description?.trim() || null,
        projectStatus,
        timeline: 'PAST',
        completedYear: v.year ? Number(v.year) : null,
        completedMonth: v.month ? Number(v.month) : null,
        projectType: v.projectType
          ? PROJECT_TYPE_TO_ENUM[v.projectType] ?? 'OTHER'
          : 'UNSPECIFIED',
        clientType:
          v.projectType === 'Residential' ? 'RESIDENTIAL' : 'COMMERCIAL',
        city: v.location?.trim() || null,
        regionState: null as string | null,
        designerOrgId: operatingAsOrgId,
      };
    },
    [getValues, operatingAsOrgId]
  );

  const onCreate = handleSubmit(async (values) => {
    if (!values.title.trim()) {
      setError('title', { message: 'Add a name to begin.' });
      setFocus('title');
      return;
    }
    clearErrors('title');
    setSubmitting(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? 'Could not create project.');
        setSubmitting(false);
        return;
      }

      const json = await res.json();
      const id = json?.id as string | undefined;
      if (!id) {
        toast.error('Create did not return an id.');
        setSubmitting(false);
        return;
      }
      toast.success('Project created.');
      router.push(`/projects/${id}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not create project.');
      setSubmitting(false);
    }
  });

  const onSaveDraft = useCallback(async () => {
    setSavingDraft(true);
    try {
      if (draftId) {
        const res = await fetch('/api/projects', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ id: draftId, ...buildPayload('draft') }),
        });
        if (!res.ok) throw new Error('Draft update failed.');
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(buildPayload('draft')),
        });
        if (!res.ok) throw new Error('Draft save failed.');
        const json = await res.json();
        if (json?.id) setDraftId(json.id);
      }
      toast.success('Draft saved.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not save draft.');
    } finally {
      setSavingDraft(false);
    }
  }, [draftId, buildPayload]);

  // Debounced autosave (PUT) once a draft exists.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!draftId) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: draftId, ...buildPayload('draft') }),
      }).catch(() => {
        // Silent — autosave failures shouldn't interrupt typing.
      });
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [title, description, year, month, draftId, buildPayload]);

  const commitTag = useCallback(() => {
    const next = tagInput.trim();
    if (!next) return;
    if (tags.length >= TAG_LIMIT) return;
    if (tags.includes(next)) {
      setTagInput('');
      return;
    }
    setValue('tags', [...tags, next], { shouldDirty: true });
    setTagInput('');
  }, [tagInput, tags, setValue]);

  const removeTag = useCallback(
    (i: number) => {
      const next = [...tags];
      next.splice(i, 1);
      setValue('tags', next, { shouldDirty: true });
    },
    [tags, setValue]
  );

  const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTag();
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const onPickCover = () => fileInputRef.current?.click();
  const onCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setCoverFile(f);
  };
  const onRemoveCover = () => {
    setCoverFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (sessionStatus === 'loading' || !operatingAsOrgId || verifiedWorkspace !== operatingAsOrgId) {
    return (
      <main
        className="mx-auto"
        style={{
          maxWidth: 720,
          padding: '36px 40px 120px',
          color: C.textSecondary,
          fontFamily: 'var(--font-body)',
        }}
      >
        Loading…
      </main>
    );
  }

  if (!manualEntry && session?.user?.id) return <CreateProjectGuide key={`${session.user.id}:${operatingAsOrgId}`} actorId={session.user.id} workspaceId={operatingAsOrgId} onManual={() => setManualEntry(true)} />;

  return (
    <main
      className="mx-auto"
      style={{
        maxWidth: 720,
        padding: '36px 40px 120px',
        color: C.textPrimary,
        fontFamily: 'var(--font-body)',
        fontSize: 14,
      }}
    >
      <style jsx global>{`
        .fpn-input,
        .fpn-textarea,
        .fpn-select {
          width: 100%;
          background: ${C.canvas};
          border: 1px solid ${C.borderSubtle};
          border-radius: 10px;
          padding: 12px 16px;
          color: ${C.textPrimary};
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.5;
          transition: border-color ${TRANSITION}, box-shadow ${TRANSITION};
        }
        .fpn-input::placeholder,
        .fpn-textarea::placeholder {
          color: ${C.textTertiary};
        }
        .fpn-input:hover,
        .fpn-textarea:hover,
        .fpn-select:hover {
          border-color: ${C.borderStrong};
        }
        .fpn-input:focus,
        .fpn-textarea:focus,
        .fpn-select:focus {
          outline: none;
          border-color: ${C.copper};
          box-shadow: 0 0 0 3px rgba(184, 132, 92, 0.1);
        }
        .fpn-title-input {
          font-family: var(--font-headline);
          font-size: 22px;
          font-weight: 500;
          font-style: normal;
          padding: 14px 16px;
        }
        .fpn-title-input::placeholder {
          font-style: italic;
          color: ${C.textTertiary};
        }
        .fpn-textarea {
          min-height: 110px;
          resize: vertical;
        }
        .fpn-select {
          appearance: none;
          -webkit-appearance: none;
          padding-right: 40px;
          background-image: none;
          cursor: pointer;
        }
        .fpn-select-wrap {
          position: relative;
        }
        .fpn-select-wrap::after {
          content: '';
          position: absolute;
          right: 16px;
          top: 50%;
          width: 8px;
          height: 8px;
          margin-top: -6px;
          border-right: 1.5px solid ${C.textSecondary};
          border-bottom: 1.5px solid ${C.textSecondary};
          transform: rotate(45deg);
          pointer-events: none;
        }
        .fpn-focusable:focus-visible {
          outline: 2px solid ${C.copper};
          outline-offset: 2px;
        }
        a.fpn-focusable:focus-visible,
        button.fpn-focusable:focus-visible {
          outline: 2px solid ${C.copper};
          outline-offset: 2px;
          border-radius: 4px;
        }
        details.fpn-disclosure[open] .fpn-chev {
          transform: rotate(180deg);
        }
        .fpn-chev {
          transition: transform 220ms ${EASE};
        }
        .fpn-tile {
          position: relative;
          padding: 18px 18px 18px 48px;
          border-radius: 12px;
          background: ${C.canvas};
          border: 1px solid ${C.borderSubtle};
          cursor: pointer;
          transition: border-color ${TRANSITION}, box-shadow ${TRANSITION},
            background ${TRANSITION}, transform ${TRANSITION};
        }
        .fpn-tile:hover {
          border-color: ${C.borderStrong};
          transform: translateY(-1px);
        }
        .fpn-tile[data-selected='true'] {
          border-color: ${C.copper};
          background: ${C.selectedTint};
          box-shadow: 0 0 0 1px ${C.copper};
          transform: translateY(0);
        }
        .fpn-tile-ring {
          position: absolute;
          top: 20px;
          left: 18px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1.5px solid ${C.borderStrong};
          background: transparent;
          transition: border-color ${TRANSITION};
        }
        .fpn-tile[data-selected='true'] .fpn-tile-ring {
          border-color: ${C.copper};
        }
        .fpn-tile-disc {
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          background: ${C.copper};
          transform: scale(0);
          transition: transform ${TRANSITION};
        }
        .fpn-tile[data-selected='true'] .fpn-tile-disc {
          transform: scale(1);
        }
        .fpn-status-chip {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 9999px;
          background: ${C.elevated};
          color: ${C.cognac};
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .fpn-cover-tile {
          display: flex;
          gap: 18px;
          align-items: center;
          padding: 18px;
          border: 1px dashed ${C.borderStrong};
          border-radius: 12px;
          background: ${C.ground};
          cursor: pointer;
          transition: border-color ${TRANSITION}, background ${TRANSITION};
        }
        .fpn-cover-tile:hover {
          border-color: ${C.copper};
          background: ${C.selectedTint};
        }
        .fpn-cover-thumb {
          position: relative;
          width: 88px;
          height: 66px;
          border-radius: 8px;
          overflow: hidden;
          background: linear-gradient(160deg, #d6cbbc 0%, #a09485 100%);
          flex-shrink: 0;
          display: grid;
          place-items: center;
        }
        .fpn-cover-thumb::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.06) 0,
            rgba(255, 255, 255, 0.06) 1px,
            transparent 1px,
            transparent 6px
          );
        }
        .fpn-cover-label {
          position: relative;
          color: rgba(255, 255, 255, 0.8);
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .fpn-tag-container {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 10px;
          background: ${C.canvas};
          border: 1px solid ${C.borderSubtle};
          transition: border-color ${TRANSITION}, box-shadow ${TRANSITION};
        }
        .fpn-tag-container:focus-within {
          border-color: ${C.copper};
          box-shadow: 0 0 0 3px rgba(184, 132, 92, 0.1);
        }
        .fpn-tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 6px 4px 10px;
          border-radius: 9999px;
          background: ${C.elevated};
          color: ${C.cognac};
          font-size: 12px;
          font-weight: 500;
        }
        .fpn-tag-remove {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border: none;
          background: transparent;
          border-radius: 9999px;
          opacity: 0.6;
          transition: opacity ${TRANSITION}, background ${TRANSITION};
          cursor: pointer;
          color: ${C.cognac};
        }
        .fpn-tag-remove:hover {
          opacity: 1;
          background: rgba(114, 74, 49, 0.1);
        }
        .fpn-tag-input {
          flex: 1;
          min-width: 80px;
          border: none;
          outline: none;
          background: transparent;
          font-family: var(--font-body);
          font-size: 14px;
          color: ${C.textPrimary};
        }
        .fpn-tag-input::placeholder {
          color: ${C.textTertiary};
        }
        .fpn-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 18px;
          border-radius: 10px;
          background: ${C.copper};
          color: #fff;
          font-weight: 500;
          font-size: 14px;
          border: none;
          cursor: pointer;
          transition: background ${TRANSITION}, transform ${TRANSITION},
            box-shadow ${TRANSITION};
        }
        .fpn-btn-primary:hover:not(:disabled) {
          background: ${C.copperHover};
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(22, 22, 20, 0.08);
        }
        .fpn-btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .fpn-btn-ghost {
          padding: 11px 18px;
          border-radius: 10px;
          border: 1px solid ${C.borderStrong};
          background: ${C.canvas};
          color: ${C.textPrimary};
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: background ${TRANSITION};
        }
        .fpn-btn-ghost:hover:not(:disabled) {
          background: ${C.ground};
        }
        .fpn-btn-text {
          background: none;
          border: none;
          padding: 0;
          color: ${C.textSecondary};
          font-size: 14px;
          font-family: var(--font-body);
          cursor: pointer;
          transition: color ${TRANSITION};
        }
        .fpn-btn-text:hover {
          color: ${C.textPrimary};
        }
        .fpn-link-copper {
          color: ${C.copper};
          font-weight: 500;
          text-decoration: none;
        }
        .fpn-link-secondary {
          color: ${C.textSecondary};
          text-decoration: none;
          transition: color ${TRANSITION};
        }
        .fpn-link-secondary:hover {
          color: ${C.copper};
        }
        @media (max-width: 720px) {
          .fpn-h1 {
            font-size: 40px !important;
          }
          .fpn-tile-grid,
          .fpn-two-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{ fontSize: 13, color: C.textSecondary, marginBottom: 28 }}
      >
        <Link
          href="/projects"
          className="fpn-link-secondary fpn-focusable"
          style={{ marginRight: 6 }}
        >
          Projects
        </Link>
        <span style={{ margin: '0 6px', color: C.textTertiary }}>/</span>
        <span style={{ color: C.textPrimary }}>New</span>
      </nav>

      <div style={{ borderTop: `1px solid ${C.borderSubtle}`, marginBottom: 36 }} />

      {/* Header */}
      <header style={{ marginBottom: 36 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 'var(--ls-eyebrow)',
            fontWeight: 'var(--w-ui)',
            color: C.textSecondary,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          A new project
        </div>
        <h1
          className="fpn-h1"
          style={{
            fontFamily: 'var(--font-headline)',
            fontStyle: 'italic',
            fontWeight: 'var(--w-ui)',
            fontSize: 56,
            lineHeight: 1.02,
            letterSpacing: '-0.01em' /* folio-design-system: off-scale */,
            color: C.textPrimary,
            margin: 0,
          }}
        >
          Begin a project
        </h1>
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 14,
            color: C.textSecondary,
          }}
        >
          <span>Creating under</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px 4px 4px',
              borderRadius: 9999,
              background: C.ground,
              border: `1px solid ${C.borderSubtle}`,
              color: C.textPrimary,
              fontSize: 13,
              fontWeight: 'var(--w-ui)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background:
                  'linear-gradient(135deg, #E8C9A5 0%, var(--folio-copper) 100%)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 10,
                fontWeight: 'var(--w-stat)',
                letterSpacing: '0.02em' /* folio-design-system: off-scale */,
              }}
            >
              {initialsFromName(operatingAsOrgName)}
            </span>
            <span>{operatingAsOrgName}</span>
          </span>
          <Link
            href="/profile"
            className="fpn-focusable"
            style={{
              color: C.textTertiary,
              textDecoration: 'none',
              fontSize: 13,
              transition: `color ${TRANSITION}`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.copper)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textTertiary)}
          >
            Switch workspace
          </Link>
        </div>
      </header>

      <form
        onSubmit={onCreate}
        noValidate
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* Project title */}
        <Field label="Project title" required>
          <input
            {...register('title', {
              maxLength: TITLE_MAX,
              onChange: () => {
                if (errors.title) clearErrors('title');
              },
            })}
            className="fpn-input fpn-title-input fpn-focusable"
            placeholder="Modern coastal living room"
            maxLength={TITLE_MAX}
            aria-invalid={!!errors.title}
            style={errors.title ? { borderColor: C.cognac } : undefined}
          />
          <Counter value={`${title.length} / ${TITLE_MAX}`} />
          {errors.title?.message && (
            <p style={{ marginTop: 8, color: C.cognac, fontSize: 12 }}>
              {errors.title.message}
            </p>
          )}
        </Field>

        <Field label="When was it completed?" required help="For older projects, the year alone is fine.">
          <div className="fpn-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <label style={{ fontSize: 13, color: C.textPrimary }}>Year
              <input
                {...register('year', { validate: value => completionDateInputError(value, '') ?? true })}
                aria-label="Completion year"
                aria-invalid={!!errors.year}
                type="number" inputMode="numeric" min={1800} max={new Date().getUTCFullYear()} required
                className="fpn-input fpn-focusable" placeholder="e.g., 2024"
              />
            </label>
            <label style={{ fontSize: 13, color: C.textPrimary }}>Month, if known
              <select
                {...register('month', { validate: value => !getValues('year') || (completionDateInputError(getValues('year'), value) ?? true) })}
                aria-label="Completion month"
                aria-invalid={!!errors.month}
                className="fpn-select fpn-focusable"
              >
                <option value="">Month unknown</option>
                {COMPLETION_MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select>
            </label>
          </div>
          {(errors.year?.message || errors.month?.message) && <p role="alert" style={{ marginTop: 8, color: C.cognac, fontSize: 12 }}>{errors.year?.message || errors.month?.message}</p>}
        </Field>

        {/* Description */}
        <Field
          label="Description"
          optional
          help="A short paragraph that will appear under the title on your project page. Can be edited at any time."
        >
          <textarea
            {...register('description', { maxLength: DESCRIPTION_MAX })}
            className="fpn-textarea fpn-focusable"
            placeholder="A brief note on the concept — location, brief, materials of interest."
            maxLength={DESCRIPTION_MAX}
          />
          <Counter value={`${description.length} / ${DESCRIPTION_MAX}`} />
        </Field>

        {/* Advanced details */}
        <details
          className="fpn-disclosure"
          style={{
            border: `1px solid ${C.borderSubtle}`,
            borderRadius: 12,
            background: C.canvas,
            marginBottom: 32,
          }}
        >
          <summary
            className="fpn-focusable"
            style={{
              listStyle: 'none',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              fontWeight: 'var(--w-ui)',
              fontSize: 14,
              color: C.textPrimary,
            }}
          >
            <Settings2 size={14} strokeWidth={1.6} />
            <span>Advanced details</span>
            <span
              style={{
                marginLeft: 4,
                color: C.textTertiary,
                fontWeight: 'var(--w-body)',
                fontSize: 12,
              }}
            >
              Optional — can be edited later
            </span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>
              <ChevronDown size={14} className="fpn-chev" />
            </span>
          </summary>

          <div
            style={{
              padding: '8px 18px 22px',
              borderTop: `1px solid ${C.borderSubtle}`,
            }}
          >
            {/* Cover image */}
            <SubField label="Cover image" optional style={{ marginTop: 22 }}>
              {!coverFile ? (
                <button
                  type="button"
                  onClick={onPickCover}
                  className="fpn-cover-tile fpn-focusable"
                  style={{ width: '100%', textAlign: 'left' }}
                  aria-label="Choose cover image"
                >
                  <span className="fpn-cover-thumb">
                    <span className="fpn-cover-label">Cover</span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 'var(--w-ui)', color: C.textPrimary }}>
                      Drop a hero image here
                    </span>
                    <span style={{ fontSize: 12, color: C.textTertiary }}>
                      Or <span className="fpn-link-copper">browse files</span> — JPG,
                      PNG, HEIC. Up to 24 MB.
                    </span>
                  </span>
                </button>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    gap: 18,
                    alignItems: 'center',
                    padding: 18,
                    border: `1px solid ${C.borderSubtle}`,
                    borderRadius: 12,
                    background: C.canvas,
                  }}
                >
                  <CoverPreview file={coverFile} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <span style={{ fontSize: 14, color: C.textPrimary, fontWeight: 'var(--w-ui)' }}>
                      {coverFile.name}
                    </span>
                    <span style={{ display: 'flex', gap: 16 }}>
                      <button
                        type="button"
                        onClick={onPickCover}
                        className="fpn-btn-text fpn-focusable"
                        style={{ color: C.copper, fontWeight: 'var(--w-ui)' }}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={onRemoveCover}
                        className="fpn-btn-text fpn-focusable"
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onCoverChange}
                hidden
              />
            </SubField>

            {/* Project type + Discipline */}
            <div
              className="fpn-two-col"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 18,
                marginTop: 22,
              }}
            >
              <SubField label="Project type" optional>
                <div className="fpn-select-wrap">
                  <select
                    {...register('projectType')}
                    className="fpn-select fpn-focusable"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select project type
                    </option>
                    {PROJECT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </SubField>
              <SubField label="Discipline" optional>
                <div className="fpn-select-wrap">
                  <select
                    {...register('discipline')}
                    className="fpn-select fpn-focusable"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select discipline
                    </option>
                    {DISCIPLINES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </SubField>
            </div>

            {/* Location */}
            <div
              className="fpn-two-col"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 18,
                marginTop: 22,
              }}
            >
              <SubField label="Location" optional>
                <input
                  {...register('location')}
                  className="fpn-input fpn-focusable"
                  placeholder="City, country"
                />
              </SubField>
            </div>

            {/* Tags */}
            <SubField
              label="Tags"
              rightLabel={
                <span style={{ fontSize: 12, color: C.textTertiary }}>Up to 6</span>
              }
              style={{ marginTop: 22 }}
            >
              <div className="fpn-tag-container">
                {tags.map((t, i) => (
                  <span key={`${t}-${i}`} className="fpn-tag-chip">
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(i)}
                      className="fpn-tag-remove fpn-focusable"
                      aria-label={`Remove ${t}`}
                    >
                      <X size={10} strokeWidth={2} />
                    </button>
                  </span>
                ))}
                {tags.length < TAG_LIMIT && (
                  <input
                    className="fpn-tag-input fpn-focusable"
                    placeholder={tags.length === 0 ? 'Add a tag…' : ''}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={onTagKeyDown}
                    onBlur={commitTag}
                  />
                )}
              </div>
            </SubField>

            {/* Visibility */}
            <SubField
              label="Visibility"
              optional
              help="You can change this any time. Published projects are reviewed before appearing in the public directory."
              style={{ marginTop: 22 }}
            >
              <div className="fpn-select-wrap">
                <select
                  {...register('visibility')}
                  className="fpn-select fpn-focusable"
                >
                  <option value="private">Private — workspace only</option>
                  <option value="unlisted">Unlisted — anyone with the link</option>
                  <option value="public">Public — listed in the directory</option>
                </select>
              </div>
            </SubField>
          </div>
        </details>

        {/* Footer */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 24,
            borderTop: `1px solid ${C.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <p
            style={{
              flex: 1,
              minWidth: 240,
              fontSize: 12,
              color: C.textTertiary,
              margin: 0,
            }}
          >
            <span aria-hidden style={{ color: C.gold, marginRight: 6 }}>
              {'✦'}
            </span>
            Drafts save automatically. You can return any time from{' '}
            <Link
              href="/projects"
              className="fpn-link-secondary fpn-focusable"
              style={{ color: C.textSecondary }}
            >
              Projects → Drafts
            </Link>
            .
          </p>
          <button
            type="button"
            className="fpn-btn-text fpn-focusable"
            onClick={() => router.push('/projects')}
          >
            Cancel
          </button>
          <button
            type="button"
            className="fpn-btn-ghost fpn-focusable"
            onClick={onSaveDraft}
            disabled={savingDraft}
          >
            {savingDraft ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="submit"
            className="fpn-btn-primary fpn-focusable"
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create project'}
            <ArrowRight size={14} strokeWidth={2} />
          </button>
        </div>
      </form>
    </main>
  );
}

// ── Local primitives ──────────────────────────────────────────────────

function Counter({ value }: { value: string }) {
  return (
    <div
      style={{
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        fontSize: 11,
        color: C.textTertiary,
        textAlign: 'right',
        marginTop: 6,
      }}
    >
      {value}
    </div>
  );
}

function Field({
  label,
  required,
  optional,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <label
          style={{
            fontSize: 13,
            fontWeight: 'var(--w-ui)',
            color: C.textPrimary,
          }}
        >
          {label}
        </label>
        {required && (
          <span style={{ fontSize: 11, color: C.copper }}>Required</span>
        )}
        {optional && !required && (
          <span style={{ fontSize: 12, color: C.textTertiary }}>Optional</span>
        )}
      </div>
      {children}
      {help && (
        <p style={{ marginTop: 8, fontSize: 12, color: C.textTertiary }}>
          {help}
        </p>
      )}
    </div>
  );
}

function SubField({
  label,
  optional,
  required,
  help,
  rightLabel,
  children,
  style,
}: {
  label: string;
  optional?: boolean;
  required?: boolean;
  help?: string;
  rightLabel?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <label
          style={{
            fontSize: 13,
            fontWeight: 'var(--w-ui)',
            color: C.textPrimary,
          }}
        >
          {label}
        </label>
        {rightLabel ??
          (required ? (
            <span style={{ fontSize: 11, color: C.copper }}>Required</span>
          ) : optional ? (
            <span style={{ fontSize: 12, color: C.textTertiary }}>Optional</span>
          ) : null)}
      </div>
      {children}
      {help && (
        <p style={{ marginTop: 8, fontSize: 12, color: C.textTertiary }}>
          {help}
        </p>
      )}
    </div>
  );
}

function CoverPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <span
      style={{
        width: 88,
        height: 66,
        borderRadius: 8,
        overflow: 'hidden',
        background: C.elevated,
        flexShrink: 0,
        display: 'block',
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </span>
  );
}
