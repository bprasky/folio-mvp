'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PHOTOGRAPHY_STYLE_OPTIONS = [
  'Interior',
  'Architectural',
  'Lifestyle',
  'Portrait',
  'Commercial',
  'Editorial',
];

export default function PhotographerSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    bio: '',
    location: '',
    website: '',
    instagram: '',
    photographyStyles: [] as string[],
    travelRadius: '',
    bookingEmail: '',
    bookingUrl: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status === 'authenticated') {
      fetchProfile();
    }
  }, [status, router]);

  async function fetchProfile() {
    try {
      const res = await fetch('/api/photographer/profile');
      if (res.ok) {
        const data = await res.json();
        const p = data.profile;
        setForm({
          name: p.name || '',
          bio: p.bio || '',
          location: p.location || '',
          website: p.website || '',
          instagram: p.instagram || '',
          photographyStyles: p.photographyStyles || [],
          travelRadius: p.travelRadius || '',
          bookingEmail: p.bookingEmail || '',
          bookingUrl: p.bookingUrl || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/photographer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setMessage('Profile saved successfully!');
      } else {
        const data = await res.json();
        setMessage(data.error || 'Failed to save profile');
      }
    } catch (error) {
      setMessage('Error saving profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggleStyle(style: string) {
    setForm((prev) => ({
      ...prev,
      photographyStyles: prev.photographyStyles.includes(style)
        ? prev.photographyStyles.filter((s) => s !== style)
        : [...prev.photographyStyles, style],
    }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-folio-text-tertiary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas px-4 py-12">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="folio-h2 mb-2">Profile Settings</h1>
          <p className="folio-body text-folio-text-secondary">
            Update your photographer profile and booking information.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
              Name / Studio Name *
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Jane Rivera Photography"
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
              Location
            </label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Orlando, FL"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
              About
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Tell designers about your work, style, and experience..."
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-folio-border-subtle bg-white px-3 py-2 text-sm text-folio-text-primary placeholder:text-folio-text-tertiary focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
            />
          </div>

          {/* Photography Styles */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-2">
              Photography Styles
            </label>
            <div className="flex flex-wrap gap-2">
              {PHOTOGRAPHY_STYLE_OPTIONS.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => toggleStyle(style.toLowerCase())}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    form.photographyStyles.includes(style.toLowerCase())
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-white text-folio-text-secondary border-folio-border-subtle hover:border-[var(--accent)]'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Travel Radius */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
              Travel Radius
            </label>
            <Input
              value={form.travelRadius}
              onChange={(e) => setForm({ ...form, travelRadius: e.target.value })}
              placeholder="Southeast US, Nationwide, etc."
            />
          </div>

          {/* Divider */}
          <div className="h-px bg-[var(--ridge-outer)]" />

          {/* Booking Info */}
          <h2 className="text-sm font-semibold text-folio-text-primary uppercase tracking-wider">
            Booking & Contact
          </h2>

          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
              Booking URL
            </label>
            <Input
              type="url"
              value={form.bookingUrl}
              onChange={(e) => setForm({ ...form, bookingUrl: e.target.value })}
              placeholder="https://calendly.com/your-link"
            />
            <p className="folio-meta mt-1">Calendly, HoneyBook, or other booking page</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
              Booking Email
            </label>
            <Input
              type="email"
              value={form.bookingEmail}
              onChange={(e) => setForm({ ...form, bookingEmail: e.target.value })}
              placeholder="bookings@example.com"
            />
            <p className="folio-meta mt-1">Separate from your account email (for hire inquiries)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
              Website
            </label>
            <Input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://yoursite.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
              Instagram
            </label>
            <Input
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              placeholder="yourhandle"
            />
          </div>

          {/* Messages */}
          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.includes('success')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message}
            </div>
          )}

          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </form>
      </div>
    </div>
  );
}
