'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FaCamera } from 'react-icons/fa';

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

          // Check if current user is admin/owner
          const userMember = data.members?.find(
            (m: any) => m.userId === session?.user?.id
          );
          setIsAuthorized(
            userMember && ['OWNER', 'ADMIN'].includes(userMember.role)
          );
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
  }, [orgId, session]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/orgs/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
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
    }
  };

  const removeSpecialty = (s: string) => {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((sp) => sp !== s),
    }));
  };

  const initials = form.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAF9F7' }}>
        <p className="text-sm" style={{ color: '#8B8178' }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAF9F7' }}>
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2" style={{ color: '#2C2825' }}>Access Denied</h3>
          <p className="text-sm mb-4" style={{ color: '#8B8178' }}>
            You need admin or owner access to edit this organization.
          </p>
          <button
            onClick={() => router.push(`/org/${orgId}`)}
            className="px-5 py-2 text-sm rounded-full transition-all hover:opacity-80"
            style={{ backgroundColor: '#2C2825', color: '#FAF9F7' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const inputStyle = {
    borderColor: '#E8E4DF',
    backgroundColor: '#FAF9F7',
    color: '#2C2825',
    fontFamily: 'var(--font-body)',
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF9F7' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl italic mb-2"
            style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 400 }}
          >
            Studio Profile
          </h1>
          <p className="text-sm" style={{ color: '#8B8178', fontFamily: 'var(--font-body)' }}>
            This is what designers, vendors, and clients see when they visit your profile.
          </p>
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
          {/* Name */}
          <Field label="Studio Name">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[#B8845C]"
              style={inputStyle}
            />
          </Field>

          {/* Tagline */}
          <Field label="Tagline">
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              placeholder="A short phrase that captures your studio's identity"
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[#B8845C]"
              style={inputStyle}
            />
          </Field>

          {/* Bio / Description */}
          <Field label="Bio">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Tell the story of your studio..."
              rows={5}
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[#B8845C] resize-none"
              style={inputStyle}
            />
          </Field>

          {/* Philosophy */}
          <Field label="Design Philosophy">
            <textarea
              value={form.philosophy}
              onChange={(e) => setForm((f) => ({ ...f, philosophy: e.target.value }))}
              placeholder="What guides your approach to design?"
              rows={3}
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[#B8845C] resize-none"
              style={inputStyle}
            />
          </Field>

          {/* Location */}
          <Field label="Location">
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Miami, FL"
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[#B8845C]"
              style={inputStyle}
            />
          </Field>

          {/* Website */}
          <Field label="Website">
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://yourstudio.com"
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[#B8845C]"
              style={inputStyle}
            />
          </Field>

          {/* Founded Year */}
          <Field label="Founded Year">
            <input
              type="number"
              value={form.foundedYear}
              onChange={(e) => setForm((f) => ({ ...f, foundedYear: e.target.value }))}
              placeholder="2015"
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[#B8845C]"
              style={inputStyle}
            />
          </Field>

          {/* Specialties */}
          <Field label="Specialties">
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
                className="flex-1 px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[#B8845C]"
                style={inputStyle}
              />
              <button
                onClick={addSpecialty}
                className="px-4 py-2.5 text-sm rounded-xl transition-all hover:opacity-80"
                style={{ border: '1px solid #D4CEC6', color: '#6B635B' }}
              >
                Add
              </button>
            </div>
          </Field>
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
            style={{ backgroundColor: '#2C2825', color: '#FAF9F7' }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="text-xs font-medium mb-1.5 block"
        style={{ color: '#6B635B', fontFamily: 'var(--font-body)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
