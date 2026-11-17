'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { projectEntryHref, professionalEntryHref } from '@/lib/onboarding/professional-entry';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowRight } from 'lucide-react';
import { CreateProjectGuide } from '@/components/interviews/CreateProjectGuide';
import { COMPLETION_MONTHS, completionDateInputError } from '@/lib/projects/completionDate';

import styles from '@/components/ui/WorkflowForms.module.css';
import { useProjectDraftWriter } from '@/lib/projects/useProjectDraftWriter';

type FormValues = {
  title: string;
  description: string;
  projectType: string;
  location: string;
  year: string;
  month: string;
};

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 280;

const PROJECT_TYPES = [
  'Residential',
  'Hospitality',
  'Commercial',
  'Retail',
  'Editorial',
  'Set',
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

export default function CreateProjectPage() {
  const { data: session } = useSession();
  // A saved draft must never carry across accounts or firm workspace switches.
  return <CreateProjectForm key={`${session?.user?.id ?? 'guest'}:${session?.user?.operatingAsOrgId ?? ''}`} />;
}

function CreateProjectForm() {
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
      location: '',
      year: '',
      month: '',
    },
  });

  const title = watch('title');
  const description = watch('description');
  const year = watch('year');
  const month = watch('month');
  const projectType = watch('projectType');
  const location = watch('location');

  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const writer = useProjectDraftWriter('manual');
  const continuing = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autosaving, setAutosaving] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    continuing.current = true;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setSubmitting(true);
    setSaveError(null);
    try {
      const id = await writer(buildPayload());
      setDraftId(id);
      toast.success('Project saved.');
      router.push(`/project/${encodeURIComponent(id)}?view=media`);
    } catch (err: any) {
      continuing.current = false;
      setSaveError(err?.message ?? 'Could not save project.');
      setSubmitting(false);
    }
  });

  const onSaveDraft = useCallback(async () => {
    if (!getValues('title').trim()) {
      setError('title', { message: 'Add a name to save your draft.' });
      setFocus('title');
      return;
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setSavingDraft(true);
    setSaveError(null);
    try {
      const id = await writer(buildPayload('draft'));
      setDraftId(id);
      toast.success('Draft saved.');
    } catch (err: any) {
      setSaveError(err?.message ?? 'Could not save draft.');
    } finally {
      setSavingDraft(false);
    }
  }, [buildPayload, getValues, setError, setFocus]);

  useEffect(() => {
    if (!draftId || continuing.current) return;
    if (!title.trim()) {
      setSaveError('Add a name before saving your changes.');
      return;
    }
    autosaveTimer.current = setTimeout(() => {
      setAutosaving(true);
      writer(buildPayload('draft')).then(() => {
        setSaveError(null);
      }).catch((error: Error) => {
        setSaveError(error.message || 'Changes could not be saved. Try Save draft again.');
      }).finally(() => setAutosaving(false));
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [title, description, year, month, projectType, location, draftId, buildPayload]);

  if (sessionStatus === 'loading' || !operatingAsOrgId || verifiedWorkspace !== operatingAsOrgId) {
    return <main className={styles.page}><p role="status" className={styles.help}>Loading…</p></main>;
  }

  if (!manualEntry && session?.user?.id) return <CreateProjectGuide key={`${session.user.id}:${operatingAsOrgId}`} actorId={session.user.id} workspaceId={operatingAsOrgId} onManual={() => setManualEntry(true)} />;

  return <main className={styles.page}>
    <nav aria-label="Breadcrumb" className="mb-8"><Link className={styles.quiet} href="/projects">Projects</Link><span aria-hidden> / </span><span className={styles.help}>New</span></nav>
    <header className={styles.header}>
      <p className={styles.eyebrow}>A new project</p>
      <h1 className={styles.title}>Begin a project</h1>
      <div className={`${styles.actions} mt-4`}><p className={styles.help}>Creating under <strong className="text-folio-text-primary">{operatingAsOrgName}</strong></p><Link className={styles.quiet} href="/profile">Switch workspace</Link></div>
    </header>
    <form onSubmit={onCreate} noValidate className={`${styles.stack} max-w-2xl`}>
      <label className={styles.label}>Project title
        <input {...register('title', { maxLength: TITLE_MAX, onChange: () => { if (errors.title) clearErrors('title'); } })} className={styles.field} placeholder="Name your project" maxLength={TITLE_MAX} aria-invalid={!!errors.title} aria-describedby={errors.title ? 'project-title-error' : undefined} />
      </label>
      {errors.title?.message && <p id="project-title-error" role="alert" className={styles.notice}>{errors.title.message}</p>}
      <fieldset className={styles.stack}>
        <legend className={`${styles.label} mb-3`}>When was it completed?</legend>
        <div className={styles.row}>
          <label className={styles.label}>Year
            <input {...register('year', { validate: value => completionDateInputError(value, '') ?? true })} aria-label="Completion year" aria-invalid={!!errors.year} type="number" inputMode="numeric" min={1800} max={new Date().getUTCFullYear()} required className={styles.field} placeholder="e.g., 2024" />
          </label>
          <label className={styles.label}>Month, if known
            <select {...register('month', { validate: value => !getValues('year') || (completionDateInputError(getValues('year'), value) ?? true) })} aria-label="Completion month" aria-invalid={!!errors.month} className={styles.field}>
              <option value="">Month unknown</option>
              {COMPLETION_MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
          </label>
        </div>
        <p className={styles.help}>For older projects, the year alone is fine.</p>
        {(errors.year?.message || errors.month?.message) && <p role="alert" className={styles.notice}>{errors.year?.message || errors.month?.message}</p>}
      </fieldset>
      <details className={styles.disclosure}>
        <summary>Additional details <span className={styles.help}>— optional</span></summary>
        <div className={styles.stack}>
          <label className={styles.label}>Description
            <textarea {...register('description', { maxLength: DESCRIPTION_MAX })} className={styles.field} maxLength={DESCRIPTION_MAX} rows={3} />
            <span className={styles.help}>Optional. You can tell the story in your interview later.</span>
          </label>
          <div className={styles.row}>
            <label className={styles.label}>Project type
              <select {...register('projectType')} className={styles.field} defaultValue=""><option value="">Select project type</option>{PROJECT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>
            </label>
            <label className={styles.label}>Location<input {...register('location')} className={styles.field} placeholder="City, country" /></label>
          </div>
        </div>
      </details>
      <p className={styles.help}>Add photos and product tags in the project workspace. Your project stays private until the publishing review is complete.</p>
      {saveError && <p role="alert" className={styles.notice}>{saveError} Your latest changes may not be saved. Try Save draft again.</p>}
      {autosaving && <p role="status" className={styles.help}>Saving changes…</p>}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={submitting || savingDraft || autosaving}>{submitting ? 'Creating…' : 'Create project'}<ArrowRight size={16} aria-hidden /></button>
        <button type="button" className={styles.secondary} onClick={onSaveDraft} disabled={savingDraft || submitting || autosaving}>{savingDraft ? 'Saving…' : 'Save draft'}</button>
        <button type="button" className={styles.quiet} onClick={() => router.push('/projects')}>Cancel</button>
      </div>
      <p className={styles.help}>{draftId ? 'Draft saved. Later edits save automatically; check for any save error before leaving.' : 'Choose Save draft to keep your work before leaving.'} You can return from <Link className="underline underline-offset-4" href="/projects">Projects → Drafts</Link>.</p>
    </form>
  </main>;
}
