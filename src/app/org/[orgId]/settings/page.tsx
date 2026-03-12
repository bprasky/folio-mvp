'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import {
  FaArrowLeft,
  FaSave,
  FaGlobe,
  FaPhone,
  FaMapMarkerAlt,
  FaCamera,
  FaBuilding,
} from 'react-icons/fa';
import Link from 'next/link';

interface OrgData {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string | null;
  website?: string | null;
  logo?: string | null;
  address?: string | null;
  phone?: string | null;
  members: { userId: string; role: string }[];
}

export default function OrgSettingsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { data: session } = useSession();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
    address: '',
    phone: '',
  });

  useEffect(() => {
    if (session?.user && orgId) {
      fetchOrg();
    }
  }, [session, orgId]);

  const fetchOrg = async () => {
    try {
      const response = await fetch(`/api/orgs/${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        setFormData({
          name: data.name || '',
          description: data.description || '',
          website: data.website || '',
          address: data.address || '',
          phone: data.phone || '',
        });

        // Check if current user is admin/owner
        const userMember = data.members?.find(
          (m: any) => m.userId === session?.user?.id
        );
        setIsAuthorized(
          userMember && ['OWNER', 'ADMIN'].includes(userMember.role)
        );
      }
    } catch (error) {
      console.error('Error fetching org:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const { org: updated } = await response.json();
        setOrg(prev => prev ? { ...prev, ...updated } : prev);
        setSaveMessage('Changes saved successfully');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const err = await response.json();
        setSaveMessage(err.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Error saving org:', error);
      setSaveMessage('Failed to save changes');
    } finally {
      setIsSaving(false);
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
        setOrg(prev => prev ? { ...prev, logo } : prev);
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const initials = org?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-elevated)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto" />
          <p className="mt-4 text-[var(--text-secondary)]">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (!org || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[var(--bg-elevated)] flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
            {!org ? 'Organization Not Found' : 'Access Denied'}
          </h3>
          <p className="text-[var(--text-secondary)] mb-4">
            {!org
              ? 'Unable to load this organization.'
              : 'You need admin or owner access to edit this organization.'}
          </p>
          <Link
            href={org ? `/org/${orgId}` : '/'}
            className="bg-[var(--accent)] text-white px-4 py-2 rounded-md hover:bg-[var(--accent-hover)]"
          >
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-elevated)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/org/${orgId}`}
            className="inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Back to {org.name}
          </Link>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Organization Settings</h1>
          <p className="text-[var(--text-secondary)] mt-2">Manage your organization&apos;s profile and information</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          {/* Org Header with Logo */}
          <div className="p-6 border-b border-[var(--ridge-outer)]">
            <div className="flex items-center space-x-4">
              <div
                className="relative w-20 h-20 rounded-full flex items-center justify-center cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
                title="Change organization logo"
              >
                {org.logo ? (
                  <img
                    src={org.logo}
                    alt={org.name}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
                  >
                    <span className="text-2xl font-light">{initials}</span>
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
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{org.name}</h2>
                <span className="inline-block bg-[var(--accent)]/10 text-[var(--accent-hover)] text-xs px-2 py-1 rounded-full mt-1">
                  {org.type.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Organization Name
                  </label>
                  <div className="relative">
                    <FaBuilding className="absolute left-3 top-3 text-[var(--text-tertiary)]" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-[var(--ridge-outer)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Website
                  </label>
                  <div className="relative">
                    <FaGlobe className="absolute left-3 top-3 text-[var(--text-tertiary)]" />
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-[var(--ridge-outer)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      placeholder="https://yourfirm.com"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-[var(--ridge-outer)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="Tell people about your organization..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Address
                  </label>
                  <div className="relative">
                    <FaMapMarkerAlt className="absolute left-3 top-3 text-[var(--text-tertiary)]" />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-[var(--ridge-outer)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      placeholder="123 Main St, City, State"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Phone
                  </label>
                  <div className="relative">
                    <FaPhone className="absolute left-3 top-3 text-[var(--text-tertiary)]" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-[var(--ridge-outer)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6">
                {saveMessage && (
                  <p className={`text-sm ${saveMessage.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
                    {saveMessage}
                  </p>
                )}
                <div className="flex justify-end space-x-3 ml-auto">
                  <Link
                    href={`/org/${orgId}`}
                    className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] flex items-center disabled:opacity-50"
                  >
                    <FaSave className="mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
