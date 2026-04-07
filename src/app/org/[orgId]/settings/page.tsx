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
      <div className="min-h-screen flex items-center justify-center bg-surface-ground">
        <p className="text-sm text-folio-text-secondary">Loading...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-ground">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2 text-folio-text-primary">Access Denied</h3>
          <p className="text-sm mb-4 text-folio-text-secondary">
            You need admin or owner access to edit this organization.
          </p>
          <button
            onClick={() => router.push(`/org/${orgId}`)}
            className="px-5 py-2 text-sm rounded-full transition-all hover:opacity-80 bg-folio-text-primary text-surface-ground"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-ground">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl italic mb-2 text-folio-text-primary"
            style={{ fontFamily: 'var(--font-headline)', fontWeight: 400 }}
          >
            {profileSourced ? 'Review What We Heard' : 'Studio Profile'}
          </h1>
          <p className="text-sm text-folio-text-secondary" style={{ fontFamily: 'var(--font-body)' }}>
            {profileSourced
              ? 'These fields were populated from your interview. Edit anything that needs adjusting.'
              : 'This is what designers, vendors, and clients see when they visit your profile.'}
          </p>
          {interviewCompleted && (
            <button
              onClick={() => router.push(`/org/${orgId}/settings/about-interview?returnTo=profile`)}
              className="mt-3 flex items-center gap-2 text-xs transition-opacity hover:opacity-70"
              style={{ color: '#B8845C' }}
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
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-light bg-folio-border-subtle text-folio-text-secondary"
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
            <p className="text-sm font-medium text-folio-text-primary">Studio Logo</p>
            <p className="text-xs text-folio-text-secondary">Click to upload (JPEG, PNG, or WebP, max 5MB)</p>
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
                className="text-xs font-medium text-folio-text-secondary"
                style={{ fontFamily: 'var(--font-body)' }}
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
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-folio-border-subtle text-folio-text-primary"
                >
                  {s}
                  <button
                    onClick={() => removeSpecialty(s)}
                    className="ml-1 hover:opacity-70 text-folio-text-secondary"
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
                className="flex-1 px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[#B8845C] border-folio-border-subtle bg-surface-ground text-folio-text-primary"
                style={{
                  fontFamily: 'var(--font-body)',
                }}
              />
              <button
                onClick={addSpecialty}
                className="px-4 py-2.5 text-sm rounded-xl transition-all hover:opacity-80"
                style={{ border: '1px solid #D4CEC6' }}
                className="px-4 py-2.5 text-sm rounded-xl transition-all hover:opacity-80 text-folio-text-secondary"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-folio-border-subtle">
          <button
            onClick={() => router.push(`/org/${orgId}`)}
            className="px-6 py-2.5 text-sm rounded-full transition-all hover:opacity-80 text-folio-text-secondary"
            style={{ border: '1px solid #D4CEC6' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-sm rounded-full transition-all hover:opacity-80 disabled:opacity-50 bg-folio-text-primary text-surface-ground"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
