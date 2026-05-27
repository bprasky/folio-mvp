'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FaCamera } from 'react-icons/fa';
import { Mic, RefreshCw } from 'lucide-react';
import { ProfileField, getFieldDisplayState, type FieldDisplayState } from '@/components/profile/ProfileField';

interface FieldSourceMap {
  [fieldName: string]: {
    source: string;
    extractedAt: string | null;
    manuallyEditedAt: string | null;
  };
}

interface PendingJoinRequest {
  id: string;
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    profileImage: string | null;
  };
}

export default function OrgSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    foundedYear: '',
    specialties: [] as string[],
  });
  const [specialtyInput, setSpecialtyInput] = useState('');

  // Track which fields the user has edited (for source tracking)
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  const [pendingRequests, setPendingRequests] = useState<PendingJoinRequest[]>([]);
  const [requestActioningId, setRequestActioningId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrg() {
      try {
        const res = await fetch(`/api/orgs/${orgId}`);
        if (res.ok) {
          const data = await res.json();
          setForm({
            name: data.name || '',
            description: data.description || '',
            tagline: data.tagline || '',
            philosophy: data.philosophy || '',
            location: data.location || data.address || '',
            website: data.website || '',
            foundedYear: data.foundedYear ? String(data.foundedYear) : '',
            specialties: Array.isArray(data.specialties) ? data.specialties : [],
          });
          setLogoUrl(data.logo || null);
          setProfileSourced(!!data.profileSourcedFromInterview);

          // Check if current user is admin/owner
          const userMember = data.members?.find(
            (m: any) => m.userId === session?.user?.id
          );
          setIsAuthorized(
            userMember && ['OWNER', 'ADMIN'].includes(userMember.role)
          );

          // Check interview status
          const bioRes = await fetch(`/api/orgs/${orgId}/bio-interview`);
          if (bioRes.ok) {
            const bioData = await bioRes.json();
            const hasInterview = !!bioData.interview && (
              !!bioData.interview.generatedAt ||
              (bioData.interview.interviewFormat === 'conversational' && !!bioData.interview.conversationalAnswers)
            );
            setInterviewCompleted(hasInterview);

            // If interview not completed, redirect to interview page (hard gate)
            if (!hasInterview && userMember && ['OWNER', 'ADMIN'].includes(userMember.role)) {
              router.replace(`/org/${orgId}/settings/about-interview?returnTo=profile`);
              return;
            }
          }

          // Load field sources
          const sourceRes = await fetch(`/api/profile/field-source?orgId=${orgId}`);
          if (sourceRes.ok) {
            const sourceData = await sourceRes.json();
            setFieldSources(sourceData.sources || {});
          }
        }
      } catch (error) {
        console.error('Failed to load org:', error);
      } finally {
        setLoading(false);
      }
    }
    if (session?.user) {
      loadOrg();
    }
  }, [orgId, session, router]);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;
    fetch(`/api/orgs/${orgId}/join?status=PENDING`)
      .then((res) => (res.ok ? res.json() : { requests: [] }))
      .then((data) => {
        if (!cancelled) setPendingRequests(data.requests || []);
      })
      .catch(() => {
        // Soft-fail: the rest of settings still works without this section.
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, isAuthorized]);

  const handleRequestAction = async (
    requestId: string,
    action: 'approve' | 'reject'
  ) => {
    setRequestActioningId(requestId);
    setRequestError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/join`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRequestError(data.error || `Could not ${action} the request.`);
        return;
      }
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      setRequestError(`Could not ${action} the request. Please try again.`);
    } finally {
      setRequestActioningId(null);
    }
  };

  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setForm((f) => ({ ...f, [fieldName]: value }));
    setEditedFields((prev) => new Set(prev).add(fieldName));
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/orgs/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        // Update field sources for edited fields
        for (const fieldName of editedFields) {
          const existingSource = fieldSources[fieldName];
          if (existingSource?.source === 'INTERVIEW_EXTRACTED') {
            await fetch('/api/profile/field-source', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organizationId: orgId,
                fieldName,
                source: 'INTERVIEW_THEN_EDITED',
              }),
            });
          }
        }

        router.push(`/org/${orgId}?tab=about`);
      }
    } catch (error) {
      console.error('Failed to save:', error);
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
    return getFieldDisplayState(value, fieldSources[fieldName], interviewCompleted);
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
        <p className="text-sm" style={{ color: '#8B8178' }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2" style={{ color: '#2C2825' }}>Access Denied</h3>
          <p className="text-sm mb-4" style={{ color: '#8B8178' }}>
            You need admin or owner access to edit this organization.
          </p>
          <button
            onClick={() => router.push(`/org/${orgId}`)}
            className="px-5 py-2 text-sm rounded-full transition-all hover:opacity-80"
            style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface-ground)' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        {pendingRequests.length > 0 && (
          <section
            className="mb-10 p-5 rounded-2xl border"
            style={{ borderColor: '#E8E4DF', backgroundColor: '#FFFFFF' }}
            aria-label="Pending join requests"
          >
            <div className="flex items-baseline justify-between mb-4">
              <h2
                className="text-lg italic"
                style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 'var(--w-body)' }}
              >
                Pending requests
              </h2>
              <span className="text-xs" style={{ color: '#8B8178' }}>
                {pendingRequests.length} waiting
              </span>
            </div>

            <ul className="flex flex-col gap-3">
              {pendingRequests.map((req) => {
                const isPending = requestActioningId === req.id;
                const name = req.user.name?.trim() || req.user.email;
                const initials = name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <li
                    key={req.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#F5F3F0' }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm overflow-hidden"
                      style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
                    >
                      {req.user.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={req.user.profileImage}
                          alt={name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#2C2825' }}>
                        {name}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#8B8178' }}>
                        {req.user.email}
                      </p>
                      {req.message ? (
                        <p
                          className="text-xs mt-1 italic"
                          style={{ color: '#6B635B' }}
                        >
                          &ldquo;{req.message}&rdquo;
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRequestAction(req.id, 'reject')}
                        disabled={isPending}
                        className="px-3 py-1.5 text-xs rounded-full transition-all hover:opacity-80 disabled:opacity-50"
                        style={{ color: '#6B635B', border: '1px solid #D4CEC6' }}
                      >
                        {isPending ? '…' : 'Decline'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestAction(req.id, 'approve')}
                        disabled={isPending}
                        className="px-3 py-1.5 text-xs rounded-full transition-all hover:opacity-80 disabled:opacity-50"
                        style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
                      >
                        {isPending ? 'Saving…' : 'Approve'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {requestError ? (
              <p className="text-xs mt-3" style={{ color: '#A14040' }} role="alert">
                {requestError}
              </p>
            ) : null}
          </section>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl italic mb-2"
            style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 'var(--w-body)' }}
          >
            {profileSourced ? 'Review What We Heard' : 'Studio Profile'}
          </h1>
          <p className="text-sm" style={{ color: '#8B8178' }}>
            {profileSourced
              ? 'These fields were populated from your interview. Edit anything that needs adjusting.'
              : 'This is what designers, vendors, and clients see when they visit your profile.'}
          </p>
          {interviewCompleted && (
            <button
              onClick={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
              className="mt-3 flex items-center gap-2 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--folio-gold)' }}
            >
              <RefreshCw size={12} />
              Re-do interview to refresh profile
            </button>
          )}
        </div>

        {/* Logo Upload */}
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
                style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
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
            <p className="text-sm font-medium" style={{ color: '#2C2825' }}>Studio Logo</p>
            <p className="text-xs" style={{ color: '#8B8178' }}>Click to upload (JPEG, PNG, or WebP, max 5MB)</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Name — always manual, not extracted */}
          <ProfileField
            label="Studio Name"
            fieldName="name"
            value={form.name}
            displayState="manually-entered"
            onChange={handleFieldChange}
          />

          {/* Tagline */}
          <ProfileField
            label="Tagline"
            fieldName="tagline"
            value={form.tagline}
            displayState={getDisplayState('tagline', form.tagline)}
            onChange={handleFieldChange}
            onInterviewRoute={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
          />

          {/* Bio / Description */}
          <ProfileField
            label="Bio"
            fieldName="description"
            value={form.description}
            displayState={getDisplayState('description', form.description)}
            multiline
            onChange={handleFieldChange}
            onInterviewRoute={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
          />

          {/* Philosophy */}
          <ProfileField
            label="Design Philosophy"
            fieldName="philosophy"
            value={form.philosophy}
            displayState={getDisplayState('philosophy', form.philosophy)}
            multiline
            onChange={handleFieldChange}
            onInterviewRoute={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
          />

          {/* Location */}
          <ProfileField
            label="Location"
            fieldName="location"
            value={form.location}
            displayState={getDisplayState('city', form.location)}
            onChange={handleFieldChange}
            onInterviewRoute={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
          />

          {/* Website — always manual */}
          <ProfileField
            label="Website"
            fieldName="website"
            value={form.website}
            displayState="manually-entered"
            onChange={handleFieldChange}
          />

          {/* Founded Year */}
          <ProfileField
            label="Founded Year"
            fieldName="foundedYear"
            value={form.foundedYear}
            displayState={getDisplayState('foundingYear', form.foundedYear)}
            onChange={handleFieldChange}
            onInterviewRoute={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
          />

          {/* Specialties — custom rendering with tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: '#6B635B' }}
              >
                Specialties
              </label>
              {fieldSources['specialties']?.source === 'INTERVIEW_EXTRACTED' && (
                <span
                  className="text-xs italic flex items-center gap-1"
                  style={{ color: '#B8B0A6' }}
                >
                  <Mic size={10} />
                  From your interview
                </span>
              )}
              {fieldSources['specialties']?.source === 'INTERVIEW_THEN_EDITED' && (
                <span className="text-xs italic" style={{ color: '#B8B0A6' }}>
                  Edited
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.specialties.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full"
                  style={{ backgroundColor: '#E8E4DF', color: '#2C2825' }}
                >
                  {s}
                  <button
                    onClick={() => removeSpecialty(s)}
                    className="ml-1 hover:opacity-70"
                    style={{ color: '#8B8178' }}
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
                  borderColor: '#E8E4DF',
                  backgroundColor: 'var(--surface-ground)',
                  color: '#2C2825'
                  }}
              />
              <button
                onClick={addSpecialty}
                className="px-4 py-2.5 text-sm rounded-xl transition-all hover:opacity-80"
                style={{ border: '1px solid #D4CEC6', color: '#6B635B' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-10 pt-6 border-t" style={{ borderColor: '#E8E4DF' }}>
          <button
            onClick={() => router.push(`/org/${orgId}`)}
            className="px-6 py-2.5 text-sm rounded-full transition-all hover:opacity-80"
            style={{ color: '#6B635B', border: '1px solid #D4CEC6' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-sm rounded-full transition-all hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
