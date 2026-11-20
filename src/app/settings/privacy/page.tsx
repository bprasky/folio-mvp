'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import StudioDeletion from '@/components/org-profile/StudioDeletion';
import controls from '@/components/org-profile/ProfileControls.module.css';
import { isDeletableStudioType } from '@/lib/studio-deletion';
import styles from './privacy.module.css';

interface VendorVisibilityState { enabled: boolean; enabledAt: string | null }
interface Studio { id: string; name: string; type: string; userRole: string }
const roleLabels: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', MANAGER: 'Manager', MEMBER: 'Member', VIEWER: 'Viewer' };

export default function PrivacySettingsPage() {
  const { status } = useSession();
  const [visibility, setVisibility] = useState<VendorVisibilityState | null>(null);
  const [loadingVisibility, setLoadingVisibility] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [selectedStudioId, setSelectedStudioId] = useState('');
  const [loadingStudios, setLoadingStudios] = useState(true);
  const [studioError, setStudioError] = useState('');

  const loadVisibility = useCallback(async (signal?: AbortSignal) => {
    setLoadingVisibility(true); setVisibilityError('');
    try {
      const response = await fetch('/api/designer/settings/vendor-visibility', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('We could not load your vendor visibility preference.');
      const data = await response.json();
      if (!signal?.aborted) setVisibility(data);
    } catch (error) {
      if (!signal?.aborted) setVisibilityError(error instanceof Error ? error.message : 'Please try again.');
    } finally { if (!signal?.aborted) setLoadingVisibility(false); }
  }, []);

  const loadStudios = useCallback(async (signal?: AbortSignal) => {
    setLoadingStudios(true); setStudioError('');
    try {
      const response = await fetch('/api/user/workspace-context', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('We could not load your studios.');
      const data = await response.json();
      if (!Array.isArray(data.organizations)) throw new Error('We could not load your studios.');
      const available: Studio[] = data.organizations.filter((org: Studio) => isDeletableStudioType(org.type));
      if (!signal?.aborted) {
        setStudios(available);
        setSelectedStudioId(available.find(org => org.id === data.operatingAsOrgId)?.id ?? available[0]?.id ?? '');
      }
    } catch (error) {
      if (!signal?.aborted) setStudioError(error instanceof Error ? error.message : 'Please try again.');
    } finally { if (!signal?.aborted) setLoadingStudios(false); }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const controller = new AbortController();
    void loadVisibility(controller.signal);
    void loadStudios(controller.signal);
    return () => controller.abort();
  }, [status, loadVisibility, loadStudios]);

  async function updateVendorVisibility(enabled: boolean) {
    if (saving) return;
    setSaving(true); setVisibilityError('');
    try {
      const response = await fetch('/api/designer/settings/vendor-visibility', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Your preference could not be saved. Please try again.');
      setVisibility(await response.json());
      setShowConfirmDialog(false);
    } catch (error) { setVisibilityError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSaving(false); }
  }

  const studio = studios.find(org => org.id === selectedStudioId);
  const canDelete = studio?.userRole === 'OWNER' || studio?.userRole === 'ADMIN';

  return <div className={styles.page}>
    <div className={styles.content}>
      <Link href="/settings" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Settings</Link>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Your account</p>
        <h1 className={styles.title}>Privacy &amp; data</h1>
        <p className={styles.intro}>Choose what you share and manage your studio&rsquo;s presence on Folio.</p>
      </header>
      {status === 'loading' ? <p role="status" className={styles.copy}>Loading your settings…</p> : status !== 'authenticated' ?
        <div className={styles.section}>
          <p className={styles.copy}>Sign in to manage your privacy and studios.</p>
          <Link href="/auth/signin?callbackUrl=/settings/privacy" className={`${styles.button} ${controls.primary}`}>Sign in</Link>
        </div> : <>
        <section className={styles.section} aria-labelledby="vendor-visibility-title">
          <div className={styles.sectionTop}>
            <div>
              <p className={styles.eyebrow}>Sharing preferences</p>
              <h2 id="vendor-visibility-title" className={styles.sectionTitle}>Vendor visibility</h2>
            </div>
            {visibility && <button type="button" className={styles.toggle} role="switch" aria-label="Vendor visibility"
              aria-describedby="vendor-visibility-description" aria-checked={visibility.enabled} disabled={saving || loadingVisibility}
              onClick={() => { if (visibility.enabled) void updateVendorVisibility(false); else { setVisibilityError(''); setShowConfirmDialog(true); } }}>
              <span className={styles.track}><span className={styles.thumb} /></span>
            </button>}
          </div>
          <p id="vendor-visibility-description" className={styles.copy}>Allow vendors to see when you&rsquo;re specifying their products. They may contact you about samples, pricing, and events. You can turn this off at any time.</p>
          {loadingVisibility ? <p role="status" className={styles.note}>Loading your preference…</p> : visibility && <p role="status" className={styles.note}>
            {saving ? 'Saving…' : visibility.enabled ? 'On · Vendor visibility is enabled.' : 'Off · Vendor visibility is disabled.'}
          </p>}
          {visibilityError && <div className={styles.notice} role="alert">{visibilityError}
            {!visibility && <button type="button" onClick={() => void loadVisibility()} className={`${styles.button} ${controls.secondary}`}>Try again</button>}
          </div>}
        </section>

        <section className={styles.section} aria-labelledby="studio-account-title">
          <p className={styles.eyebrow}>Studio account</p>
          <h2 id="studio-account-title" className={styles.sectionTitle}>Your studio on Folio</h2>
          <p className={styles.copy}>Review studio deletion as its owner or administrator.</p>
          {loadingStudios ? <p role="status" className={styles.note}>Loading your studios…</p> : studioError ?
            <div className={styles.notice} role="alert">{studioError}<button type="button" onClick={() => void loadStudios()} className={`${styles.button} ${controls.secondary}`}>Try loading studios again</button></div> : studio ? <>
              {studios.length > 1 ? <label className={styles.studioPicker} htmlFor="privacy-studio">Choose a studio
                <select id="privacy-studio" value={selectedStudioId} onChange={event => setSelectedStudioId(event.target.value)}>
                  {studios.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              </label> : null}
              <div className={styles.studioIdentity}>
                <h3 className={styles.studioName}>{studio.name}</h3>
                <span className={styles.role}>Your role: {roleLabels[studio.userRole] ?? studio.userRole}</span>
              </div>
              {canDelete ? <StudioDeletion key={studio.id} orgId={studio.id} /> :
                <p className={styles.notice}>Only an active Owner or Admin of {studio.name} can delete this studio. Your current role is {roleLabels[studio.userRole] ?? studio.userRole}.</p>}
            </> : <p className={styles.notice}>You don&rsquo;t currently belong to a design studio, architecture firm, or contractor account. Studio deletion is available here to its owners and administrators.</p>}
        </section>

        <section className={styles.section} aria-labelledby="personal-data-title">
          <p className={styles.eyebrow}>Personal account</p>
          <h2 id="personal-data-title" className={styles.sectionTitle}>Your personal data</h2>
          <p className={styles.copy}>For a copy of your data or to request deletion of your personal account, contact <a className={styles.textLink} href="mailto:privacy@folioad.com">privacy@folioad.com</a>.</p>
        </section>

        <Dialog open={showConfirmDialog} onOpenChange={open => { if (!saving) setShowConfirmDialog(open); }}>
          <DialogContent className={`${controls.dialog} ${styles.dialog}`} onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}>
            <p className={styles.eyebrow}>Sharing preferences</p>
            <DialogTitle className={styles.dialogTitle}>Enable vendor visibility?</DialogTitle>
            <DialogDescription className={styles.copy}>Vendors will be able to see when you&rsquo;re specifying their products and may contact you about samples, pricing, and events. You can turn this off at any time.</DialogDescription>
            {visibilityError && <p className={styles.notice} role="alert">{visibilityError}</p>}
            <div className={styles.actions}>
              <button type="button" onClick={() => setShowConfirmDialog(false)} disabled={saving} className={`${styles.button} ${controls.secondary}`}>Cancel</button>
              <button type="button" onClick={() => void updateVendorVisibility(true)} disabled={saving} className={`${styles.button} ${controls.primary}`}>{saving ? 'Enabling…' : 'Enable visibility'}</button>
            </div>
          </DialogContent>
        </Dialog>
      </>}
    </div>
  </div>;
}
