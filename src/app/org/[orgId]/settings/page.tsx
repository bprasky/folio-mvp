'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function OrgSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    tagline: '',
    philosophy: '',
    location: '',
    website: '',
    logo: '',
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
            logo: data.logo || '',
            foundedYear: data.foundedYear ? String(data.foundedYear) : '',
            specialties: Array.isArray(data.specialties) ? data.specialties : [],
          });
        }
      } catch (error) {
        console.error('Failed to load org:', error);
      } finally {
        setLoading(false);
      }
    }
    loadOrg();
  }, [orgId]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAF9F7' }}>
        <p className="text-sm" style={{ color: '#8B8178' }}>Loading...</p>
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

          {/* Logo URL */}
          <Field label="Logo URL">
            <input
              type="url"
              value={form.logo}
              onChange={(e) => setForm((f) => ({ ...f, logo: e.target.value }))}
              placeholder="https://..."
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[#B8845C]"
              style={inputStyle}
            />
            {form.logo && (
              <div className="mt-2">
                <img
                  src={form.logo}
                  alt="Logo preview"
                  className="w-16 h-16 rounded-xl object-cover border"
                  style={{ borderColor: '#E8E4DF' }}
                />
              </div>
            )}
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
