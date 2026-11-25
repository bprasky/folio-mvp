'use client';

import controls from '@/components/org-profile/ProfileControls.module.css';
import forms from '@/components/ui/WorkflowForms.module.css';
import { externalIdentityUrl } from '@/lib/seo/public';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FaCamera } from 'react-icons/fa';
import { Mic, RefreshCw } from 'lucide-react';
import { ProfileField, getFieldDisplayState, type FieldDisplayState } from '@/components/profile/ProfileField';

// The tab-specific editors share the studio profile's save and permission checks.
interface FieldSourceMap {
  [fieldName: string]: {
    source: string;
    extractedAt: string | null;
    manuallyEditedAt: string | null;
  };
}

export default function OrgEditPage() {
  const params = useParams();
  const section = useSearchParams().get('section');
  const { data: session, status } = useSession();
  const orgId = params.orgId as string;
  if (status === 'loading') return <p className="p-8 folio-body" role="status">Loading studio…</p>;
  return <StudioEditor key={JSON.stringify([orgId, session?.user?.id, section])} orgId={orgId} userId={session?.user?.id} section={section} />;
}

function StudioEditor({ orgId, userId, section }: { orgId: string; userId?: string; section: string | null }) {
  const router = useRouter();
  const focused = section === 'about' || section === 'contact';
  const profileHref = '/org/' + orgId + '?tab=' + (section === 'contact' ? 'contact' : 'about') + '#profile-content';

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [profileSourced, setProfileSourced] = useState(false);
  const [fieldSources, setFieldSources] = useState<FieldSourceMap>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    tagline: '',
    philosophy: '',
    location: '',
    website: '',
    address: '',
    serviceRegions: '',
    foundedYear: '',
    specialties: [] as string[],
  });
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadOrg() {
      setLoading(true);
      setLoadFailed(false);
      try {
        const res = await fetch(`/api/orgs/${orgId}`);
        if (!res.ok && res.status !== 401 && res.status !== 403 && res.status !== 404) {
          throw new Error('Could not load this studio.');
        }
        if (res.ok) {
          const data = await res.json();
          setForm({
            name: data.name || '',
            description: data.description || '',
            tagline: data.tagline || '',
            philosophy: data.philosophy || '',
            location: data.location || '',
            website: data.website || '',
            address: data.address || '',
            serviceRegions: (data.serviceRegions || []).join('\n'),
            foundedYear: data.foundedYear ? String(data.foundedYear) : '',
            specialties: Array.isArray(data.specialties) ? data.specialties : [],
          });
          setLogoUrl(data.logo || null);
          setProfileSourced(!!data.profileSourcedFromInterview);

          const userMember = data.members?.find(
            (m: { userId: string }) => m.userId === userId
          );
          const authorized = !!userMember && ['OWNER', 'ADMIN'].includes(userMember.role);
          setIsAuthorized(authorized);

          if (focused || !authorized) return;
          const bioRes = await fetch(`/api/orgs/${orgId}/bio-interview`);
          if (bioRes.ok) {
            const bioData = await bioRes.json();
            const hasInterview = !!bioData.interview && (
              !!bioData.interview.generatedAt ||
              (bioData.interview.interviewFormat === 'conversational' && !!bioData.interview.conversationalAnswers)
            );
            setInterviewCompleted(hasInterview);
          }

          const sourceRes = await fetch(`/api/profile/field-source?orgId=${orgId}`);
          if (sourceRes.ok) {
            const sourceData = await sourceRes.json();
            setFieldSources(sourceData.sources || {});
          }
        }
      } catch (error) {
        console.error('Failed to load org:', error);
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    }
    if (userId) {
      loadOrg();
    } else {
      setLoading(false);
    }
  }, [orgId, userId, focused, attempt]);

  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setForm((f) => ({ ...f, [fieldName]: value }));
    setEditedFields((prev) => new Set(prev).add(fieldName));
  }, []);

  const handleSave = async () => {
    setError('');
    if (editedFields.has('website') && form.website.trim() && !externalIdentityUrl(form.website.trim())) {
      setError('Enter a valid studio website.');
      return;
    }
    const changes = Object.fromEntries(Object.entries(form).filter(([name]) => editedFields.has(name)));
    if (editedFields.has('serviceRegions')) {
      changes.serviceRegions = form.serviceRegions.split('\n').map(region => region.trim()).filter(Boolean);
    }
    try {
      setSaving(true);
      const res = await fetch(`/api/orgs/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });

      if (res.ok) {
        router.push(profileHref);
        router.refresh();
      } else {
        const result = await res.json().catch(() => null);
        setError(result?.error || 'Could not save your changes. Try again.');
      }
    } catch (error) {
      setError('Could not confirm the save. Your edits are still here.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/orgs/${orgId}/logo`, {
        method: 'POST',
        body: fd,
      });
      if (res.ok) {
        const { logo } = await res.json();
        setLogoUrl(logo);
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addSpecialty = () => {
    const val = specialtyInput.trim();
    if (val && !form.specialties.includes(val)) {
      setForm((prev) => ({ ...prev, specialties: [...prev.specialties, val] }));
      setSpecialtyInput('');
      setEditedFields((prev) => new Set(prev).add('specialties'));
    }
  };

  const removeSpecialty = (s: string) => {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((sp) => sp !== s),
    }));
    setEditedFields((prev) => new Set(prev).add('specialties'));
  };

  const getDisplayState = (fieldName: string, value: string | undefined): FieldDisplayState => {
    const state = getFieldDisplayState(value, fieldSources[fieldName], interviewCompleted);
    return state === 'empty-no-interview' ? 'manually-entered' : state;
  };

  const initials = form.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <p className="text-sm" style={{ color: 'var(--folio-text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  if (loadFailed) return <main className="mx-auto max-w-lg px-5 py-12">
    <p role="alert" className="folio-body mb-4">Could not load your studio details.</p>
    <button type="button" className={forms.secondary} onClick={() => setAttempt(value => value + 1)}>Try again</button>
  </main>;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--folio-text-primary)' }}>Access Denied</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--folio-text-secondary)' }}>
            You need admin or owner access to edit this organization.
          </p>
          <button
            onClick={() => router.push(`/org/${orgId}`)}
            className="px-5 py-2 text-sm rounded-full transition-all hover:opacity-80"
            style={{ backgroundColor: 'var(--folio-text-primary)', color: 'var(--surface-canvas)' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (focused) {
    const isBio = section === 'about';
    return <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className={forms.title}>{isBio ? 'Your studio bio' : 'Studio contact details'}</h1>
      <p className={forms.lede}>{isBio ? 'Introduce your studio in your own words.' : 'Choose the details clients can see on your profile.'}</p>
      <form className="mt-8" onSubmit={event => { event.preventDefault(); void handleSave(); }}>
        <fieldset className={forms.stack} disabled={saving}>
          {isBio ? <label className={forms.label}>Studio bio
            <textarea className={forms.field} rows={8} value={form.description} onChange={event => handleFieldChange('description', event.target.value)} />
          </label> : <>
            <label className={forms.label}>Studio website
              <input className={forms.field} inputMode="url" placeholder="studio.com" value={form.website} onChange={event => handleFieldChange('website', event.target.value)} />
            </label>
            <label className={forms.label}>Based in
              <input className={forms.field} placeholder="City, state" value={form.location} onChange={event => handleFieldChange('location', event.target.value)} />
            </label>
            <label className={forms.label}>Studio address
              <input className={forms.field} value={form.address} onChange={event => handleFieldChange('address', event.target.value)} />
            </label>
            <label className={forms.label}>Service areas (one per line)
              <textarea className={forms.field} rows={3} value={form.serviceRegions} onChange={event => handleFieldChange('serviceRegions', event.target.value)} />
            </label>
          </>}
          {error && <p role="alert" className="folio-body">{error}</p>}
          <div className={forms.actions}>
            <button type="submit" className={forms.primary} disabled={!editedFields.size}>{saving ? 'Saving…' : isBio ? 'Save bio' : 'Save contact details'}</button>
            <button type="button" className={forms.secondary} onClick={() => router.push(profileHref)}>Cancel</button>
          </div>
        </fieldset>
      </form>
    </main>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface-ground)' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1
            className="text-3xl italic mb-2"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--folio-text-primary)', fontWeight: 'var(--w-body)' }}
          >
            {profileSourced ? 'Review What We Heard' : 'Studio Profile'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--folio-text-secondary)' }}>
            {profileSourced
              ? 'These fields were populated from your interview. Edit anything that needs adjusting.'
              : 'This is what designers, vendors, and clients see when they visit your profile.'}
          </p>
          {interviewCompleted && (
            <button
              onClick={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
              className="mt-3 flex items-center gap-2 text-xs transition-opacity hover:underline"
              style={{ color: 'var(--folio-gold)' }}
            >
              <RefreshCw size={12} />
              Re-do interview to refresh profile
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div
            className="relative w-20 h-20 rounded-full flex items-center justify-center cursor-pointer group flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            title="Change logo"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={form.name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-light"
                style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--folio-text-secondary)' }}
              >
                {initials}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingLogo ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
              ) : (
                <FaCamera className="w-5 h-5 text-white" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--folio-text-primary)' }}>Studio Logo</p>
            <p className="text-xs" style={{ color: 'var(--folio-text-secondary)' }}>Click to upload (JPEG, PNG, or WebP, max 5MB)</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <ProfileField
            label="Studio Name"
            fieldName="name"
            value={form.name}
            displayState="manually-entered"
            onChange={handleFieldChange}
          />

          <ProfileField
            label="Tagline"
            fieldName="tagline"
            value={form.tagline}
            displayState={getDisplayState('tagline', form.tagline)}
            onChange={handleFieldChange}
            onInterviewRoute={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
          />

          <ProfileField
            label="Bio"
            fieldName="description"
            value={form.description}
            displayState={getDisplayState('description', form.description)}
            multiline
            onChange={handleFieldChange}
            onInterviewRoute={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
          />

          <ProfileField
            label="Design Philosophy"
            fieldName="philosophy"
            value={form.philosophy}
            displayState={getDisplayState('philosophy', form.philosophy)}
            multiline
            onChange={handleFieldChange}
            onInterviewRoute={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
          />

          <ProfileField
            label="Location"
            fieldName="location"
            value={form.location}
            displayState={getDisplayState('city', form.location)}
            onChange={handleFieldChange}
            onInterviewRoute={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
          />

          <ProfileField
            label="Website"
            fieldName="website"
            value={form.website}
            displayState="manually-entered"
            onChange={handleFieldChange}
          />

          <ProfileField
            label="Founded Year"
            fieldName="foundedYear"
            value={form.foundedYear}
            displayState={getDisplayState('foundingYear', form.foundedYear)}
            onChange={handleFieldChange}
            onInterviewRoute={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: 'var(--folio-text-secondary)' }}
              >
                Specialties
              </label>
              {fieldSources['specialties']?.source === 'INTERVIEW_EXTRACTED' && (
                <span
                  className="text-xs italic flex items-center gap-1"
                  style={{ color: 'var(--folio-text-secondary)' }}
                >
                  <Mic size={10} />
                  From your interview
                </span>
              )}
              {fieldSources['specialties']?.source === 'INTERVIEW_THEN_EDITED' && (
                <span className="text-xs italic" style={{ color: 'var(--folio-text-secondary)' }}>
                  Edited
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.specialties.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full"
                  style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--folio-text-primary)' }}
                >
                  {s}
                  <button
                    onClick={() => removeSpecialty(s)}
                    className="ml-1 hover:underline"
                    style={{ color: 'var(--folio-text-secondary)' }}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={specialtyInput}
                onChange={(e) => setSpecialtyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                placeholder="Add a specialty..."
                className="flex-1 px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[var(--folio-gold)]"
                style={{
                  borderColor: 'var(--folio-border-subtle)',
                  backgroundColor: 'var(--surface-ground)',
                  color: 'var(--folio-text-primary)'
                  }}
              />
              <button
                onClick={addSpecialty}
                className="px-4 py-2.5 text-sm rounded-xl transition-all hover:opacity-80"
                style={{ border: '1px solid var(--folio-border-strong)', color: 'var(--folio-text-secondary)' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 folio-body">{error}</p>}
        <div className="flex justify-end gap-3 mt-10 pt-6 border-t" style={{ borderColor: 'var(--folio-border-subtle)' }}>
          <button
            onClick={() => router.push(`/org/${orgId}`)}
            className="px-6 py-2.5 text-sm rounded-full transition-all hover:opacity-80"
            style={{ color: 'var(--folio-text-secondary)', border: '1px solid var(--folio-border-strong)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2.5 text-sm rounded-full transition-all ${controls.primary}`}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
