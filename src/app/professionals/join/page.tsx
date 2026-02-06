'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  GlassCard,
  EditorialHeadline,
  GlassInput,
  GlassButton,
} from "@/components/ui/glass";
import {
  Building2,
  Palette,
  Search,
  Plus,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Users,
  Loader2,
} from 'lucide-react';

type OrgType = 'DESIGNER' | 'VENDOR';
type Step = 'type' | 'search' | 'create' | 'request';

interface Organization {
  id: string;
  name: string;
  type: string;
  status: string;
  website?: string;
  address?: string;
  logo?: string;
  _count: {
    users: number;
  };
}

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<OrgType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Organization[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Form data for creating new org
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    website: '',
    phone: '',
    description: '',
  });

  // Join request message
  const [joinMessage, setJoinMessage] = useState('');

  // Check for type in URL params
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'DESIGNER' || typeParam === 'VENDOR') {
      setSelectedType(typeParam);
      setStep('search');
    }
  }, [searchParams]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/professionals/join');
    }
  }, [status, router]);

  // Search organizations
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/orgs/search?q=${encodeURIComponent(searchQuery)}&type=${selectedType}`
      );
      const data = await response.json();
      setSearchResults(data.organizations || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Create new organization
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      const orgType = selectedType === 'DESIGNER' ? 'DESIGN_FIRM' : 'VENDOR';

      const response = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          type: orgType,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/org/${data.id}`);
      } else {
        setMessage(data.error || 'Failed to create organization');
      }
    } catch (error) {
      console.error('Create org error:', error);
      setMessage('Error creating organization. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request to join organization
  const handleJoinRequest = async () => {
    if (!selectedOrg) return;

    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(`/api/orgs/${selectedOrg.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: joinMessage }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Join request sent successfully! You will be notified when it is reviewed.');
        setTimeout(() => router.push('/profile'), 3000);
      } else {
        setMessage(data.error || 'Failed to send join request');
      }
    } catch (error) {
      console.error('Join request error:', error);
      setMessage('Error sending join request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Claim unclaimed organization
  const handleClaimOrg = async () => {
    if (!selectedOrg) return;

    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(`/api/orgs/${selectedOrg.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/org/${selectedOrg.id}`);
      } else {
        setMessage(data.error || 'Failed to claim organization');
      }
    } catch (error) {
      console.error('Claim org error:', error);
      setMessage('Error claiming organization. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const renderTypeSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <EditorialHeadline size="lg" className="mb-2">
          What type of organization?
        </EditorialHeadline>
        <p className="text-gray-600">
          Select the type that best describes your business
        </p>
      </div>

      <div className="grid gap-4">
        <button
          type="button"
          onClick={() => {
            setSelectedType('DESIGNER');
            setStep('search');
          }}
          className="w-full p-6 bg-white/50 backdrop-blur-sm border border-gray-200/70 rounded-xl hover:border-blue-400 hover:bg-white/70 transition-all text-left shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--accent)]/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Palette className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Design Firm</h4>
              <p className="text-sm text-gray-600">
                Interior design studio, architecture firm, or design consultancy
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedType('VENDOR');
            setStep('search');
          }}
          className="w-full p-6 bg-white/50 backdrop-blur-sm border border-gray-200/70 rounded-xl hover:border-green-400 hover:bg-white/70 transition-all text-left shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Vendor / Manufacturer</h4>
              <p className="text-sm text-gray-600">
                Furniture, lighting, textiles, or other product manufacturer or showroom
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  const renderSearch = () => (
    <div className="space-y-6">
      <button
        onClick={() => {
          setStep('type');
          setSelectedType(null);
          setSearchResults([]);
          setSearchQuery('');
        }}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <div className="text-center mb-6">
        <EditorialHeadline size="lg" className="mb-2">
          Find your organization
        </EditorialHeadline>
        <p className="text-gray-600">
          Search to see if your organization already exists on Folio
        </p>
      </div>

      <div className="flex gap-2">
        <GlassInput
          type="text"
          placeholder="Search by business name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <GlassButton
          onClick={handleSearch}
          disabled={isSearching || searchQuery.length < 2}
        >
          {isSearching ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </GlassButton>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {searchResults.length} organization{searchResults.length !== 1 ? 's' : ''} found
          </p>
          {searchResults.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                setSelectedOrg(org);
                setStep('request');
              }}
              className="w-full p-4 bg-white/50 backdrop-blur-sm border border-gray-200/70 rounded-xl hover:border-blue-400 hover:bg-white/70 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">{org.name}</h4>
                    {org.status === 'CLAIMED' && (
                      <span className="px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent-hover)] text-xs rounded-full">
                        Verified
                      </span>
                    )}
                    {org.status === 'PROFESSIONAL' && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        Pro
                      </span>
                    )}
                    {org.status === 'UNCLAIMED' && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        Unclaimed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    {org.website && <span>{org.website}</span>}
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {org._count.users} member{org._count.users !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          ))}
        </div>
      )}

      {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
        <div className="text-center py-6">
          <p className="text-gray-600 mb-4">No organizations found matching "{searchQuery}"</p>
        </div>
      )}

      {/* Create New Option */}
      <div className="pt-6 border-t border-gray-200">
        <button
          onClick={() => {
            setFormData(prev => ({ ...prev, name: searchQuery }));
            setStep('create');
          }}
          className="w-full p-4 bg-white/50 backdrop-blur-sm border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-white/70 transition-all text-center"
        >
          <div className="flex items-center justify-center gap-2 text-gray-700">
            <Plus className="w-5 h-5" />
            <span className="font-medium">Create a new organization</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Don't see your organization? Create it now.
          </p>
        </button>
      </div>
    </div>
  );

  const renderCreate = () => (
    <div className="space-y-6">
      <button
        onClick={() => setStep('search')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to search</span>
      </button>

      <div className="text-center mb-6">
        <EditorialHeadline size="lg" className="mb-2">
          Create your organization
        </EditorialHeadline>
        <p className="text-gray-600">
          Fill in your business details to get started
        </p>
      </div>

      <form onSubmit={handleCreateOrg} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Business Name *
          </label>
          <GlassInput
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Your Company Name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Business Address
          </label>
          <GlassInput
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="123 Main St, City, State"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Website
          </label>
          <GlassInput
            type="url"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Phone
          </label>
          <GlassInput
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(555) 123-4567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Tell us about your business..."
            rows={3}
            className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-200/70 rounded-xl focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all resize-none"
          />
        </div>

        {message && (
          <div className={`p-3 rounded-md border ${
            message.includes('Error') || message.includes('Failed')
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            {message}
          </div>
        )}

        <GlassButton
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isSubmitting || !formData.name}
        >
          {isSubmitting ? 'Creating...' : 'Create Organization'}
        </GlassButton>
      </form>
    </div>
  );

  const renderJoinRequest = () => (
    <div className="space-y-6">
      <button
        onClick={() => {
          setStep('search');
          setSelectedOrg(null);
        }}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to search</span>
      </button>

      <div className="text-center mb-6">
        <EditorialHeadline size="lg" className="mb-2">
          {selectedOrg?.name}
        </EditorialHeadline>
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <Users className="w-4 h-4" />
          <span>{selectedOrg?._count.users} member{selectedOrg?._count.users !== 1 ? 's' : ''}</span>
          {selectedOrg?.status === 'UNCLAIMED' && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full ml-2">
              Unclaimed
            </span>
          )}
        </div>
      </div>

      {selectedOrg?.status === 'UNCLAIMED' ? (
        <div className="space-y-6">
          <GlassCard variant="subtle" padding="lg" rounded="xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">This organization is unclaimed</h4>
                <p className="text-sm text-gray-600">
                  If you are the owner of this business, you can claim it to become the administrator.
                  Otherwise, you can request to join as a member.
                </p>
              </div>
            </div>
          </GlassCard>

          <div className="grid gap-3">
            <GlassButton
              variant="primary"
              size="lg"
              onClick={handleClaimOrg}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Processing...' : 'Claim This Organization'}
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="lg"
              onClick={() => {
                setMessage('');
                // Show join form instead
              }}
              className="w-full"
            >
              Request to Join as Member
            </GlassButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <GlassCard variant="subtle" padding="lg" rounded="xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[var(--accent)]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Request to join</h4>
                <p className="text-sm text-gray-600">
                  Your request will be sent to the organization administrators for review.
                </p>
              </div>
            </div>
          </GlassCard>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Message (optional)
            </label>
            <textarea
              value={joinMessage}
              onChange={(e) => setJoinMessage(e.target.value)}
              placeholder="Introduce yourself and explain why you'd like to join..."
              rows={3}
              className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-200/70 rounded-xl focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all resize-none"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-md border ${
              message.includes('Error') || message.includes('Failed')
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              {message}
            </div>
          )}

          <GlassButton
            variant="primary"
            size="lg"
            onClick={handleJoinRequest}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Sending...' : 'Send Join Request'}
          </GlassButton>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-semibold text-gray-900">
            Folio
          </Link>
        </div>

        <GlassCard variant="strong" padding="xl" rounded="3xl">
          {step === 'type' && renderTypeSelection()}
          {step === 'search' && renderSearch()}
          {step === 'create' && renderCreate()}
          {step === 'request' && renderJoinRequest()}
        </GlassCard>
      </div>
    </div>
  );
}

export default function ProfessionalsJoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
