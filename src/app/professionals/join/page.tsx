'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaPalette,
  FaStore,
  FaSearch,
  FaPlus,
  FaBuilding,
  FaCheck,
  FaArrowLeft,
  FaArrowRight,
  FaSpinner,
} from 'react-icons/fa';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  EditorialHeadline,
} from '@/components/ui/glass';

type OrgType = 'designer' | 'vendor' | null;
type Step = 'type' | 'search' | 'create' | 'success';

interface OrgSearchResult {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  website?: string;
  _count: {
    users: number;
  };
}

export default function JoinProfessionalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>('type');
  const [orgType, setOrgType] = useState<OrgType>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrgSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdOrg, setCreatedOrg] = useState<OrgSearchResult | null>(null);

  // Form state for creating new org
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    website: '',
    phone: '',
    description: '',
  });

  // Check for type param on mount
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'designer' || type === 'vendor') {
      setOrgType(type);
      setStep('search');
    }
  }, [searchParams]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/professionals/join');
    }
  }, [status, router]);

  const handleTypeSelect = (type: OrgType) => {
    setOrgType(type);
    setStep('search');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError('');

    try {
      const typeFilter = orgType === 'designer' ? 'DESIGN_FIRM' : 'VENDOR';
      const response = await fetch(
        `/api/orgs?q=${encodeURIComponent(searchQuery)}&type=${typeFilter}`
      );

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setSearchResults(data.orgs);
    } catch (err) {
      setError('Failed to search organizations');
    } finally {
      setIsSearching(false);
    }
  };

  const handleJoinRequest = async (orgId: string) => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/orgs/${orgId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Requesting to join via professionals portal' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit join request');
      }

      // Redirect to the org page or show success
      router.push(`/org/${orgId}?joined=pending`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const type = orgType === 'designer' ? 'DESIGN_FIRM' : 'VENDOR';
      const response = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      setCreatedOrg(data.org);
      setStep('success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FaSpinner className="w-8 h-8 animate-spin text-folio-stone-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-folio-bg via-white to-folio-stone-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        {step !== 'type' && step !== 'success' && (
          <button
            onClick={() => {
              if (step === 'create') setStep('search');
              else if (step === 'search') setStep('type');
            }}
            className="flex items-center gap-2 text-folio-stone-600 hover:text-folio-ink mb-6"
          >
            <FaArrowLeft />
            Back
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Select Type */}
          {step === 'type' && (
            <motion.div
              key="type"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="text-center mb-8">
                <EditorialHeadline size="lg" className="mb-3">
                  What type of organization?
                </EditorialHeadline>
                <p className="text-folio-stone-600">
                  Select the type that best describes your business.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <GlassCard
                  variant="strong"
                  padding="lg"
                  rounded="xl"
                  className="cursor-pointer hover:shadow-folio2 transition-shadow"
                  onClick={() => handleTypeSelect('designer')}
                >
                  <div className="text-center">
                    <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FaPalette className="w-7 h-7 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-folio-ink mb-2">
                      Design Firm
                    </h3>
                    <p className="text-sm text-folio-stone-600">
                      Interior design studio or independent designer
                    </p>
                  </div>
                </GlassCard>

                <GlassCard
                  variant="strong"
                  padding="lg"
                  rounded="xl"
                  className="cursor-pointer hover:shadow-folio2 transition-shadow"
                  onClick={() => handleTypeSelect('vendor')}
                >
                  <div className="text-center">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FaStore className="w-7 h-7 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-folio-ink mb-2">
                      Vendor / Manufacturer
                    </h3>
                    <p className="text-sm text-folio-stone-600">
                      Furniture, lighting, or home goods brand
                    </p>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}

          {/* Step 2: Search for Org */}
          {step === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="text-center mb-8">
                <EditorialHeadline size="lg" className="mb-3">
                  Find your organization
                </EditorialHeadline>
                <p className="text-folio-stone-600">
                  Search for your organization or create a new one.
                </p>
              </div>

              <GlassCard variant="strong" padding="lg" rounded="xl">
                {/* Search Input */}
                <div className="flex gap-3 mb-6">
                  <GlassInput
                    type="text"
                    placeholder="Search by organization name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <GlassButton
                    variant="primary"
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                  >
                    {isSearching ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaSearch />
                    )}
                  </GlassButton>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-3 mb-6">
                    <h4 className="text-sm font-medium text-folio-stone-600">
                      Found {searchResults.length} organization(s)
                    </h4>
                    {searchResults.map((org) => (
                      <div
                        key={org.id}
                        className="flex items-center justify-between p-4 bg-folio-stone-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-folio-stone-200 rounded-lg flex items-center justify-center">
                            <FaBuilding className="text-folio-stone-500" />
                          </div>
                          <div>
                            <h5 className="font-medium text-folio-ink">
                              {org.name}
                            </h5>
                            <p className="text-sm text-folio-stone-500">
                              {org._count.users} member(s) · {org.status.toLowerCase()}
                            </p>
                          </div>
                        </div>
                        <GlassButton
                          variant="secondary"
                          size="sm"
                          onClick={() => handleJoinRequest(org.id)}
                          disabled={isSubmitting}
                        >
                          Request to Join
                        </GlassButton>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && searchResults.length === 0 && !isSearching && (
                  <p className="text-center text-folio-stone-500 mb-6">
                    No organizations found matching "{searchQuery}"
                  </p>
                )}

                {/* Create New Org Button */}
                <div className="border-t border-folio-stone-200 pt-6">
                  <button
                    onClick={() => setStep('create')}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-folio-stone-300 rounded-lg text-folio-stone-600 hover:border-folio-stone-400 hover:text-folio-ink transition-colors"
                  >
                    <FaPlus />
                    Create New Organization
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Step 3: Create New Org */}
          {step === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="text-center mb-8">
                <EditorialHeadline size="lg" className="mb-3">
                  Create your organization
                </EditorialHeadline>
                <p className="text-folio-stone-600">
                  Fill in your business details to get started.
                </p>
              </div>

              <GlassCard variant="strong" padding="lg" rounded="xl">
                <form onSubmit={handleCreateOrg} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-folio-stone-700 mb-1.5">
                      Organization Name *
                    </label>
                    <GlassInput
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Your business name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-folio-stone-700 mb-1.5">
                      Business Address *
                    </label>
                    <GlassInput
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="123 Main St, City, State ZIP"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-folio-stone-700 mb-1.5">
                      Phone Number *
                    </label>
                    <GlassInput
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-folio-stone-700 mb-1.5">
                      Website
                    </label>
                    <GlassInput
                      type="url"
                      value={formData.website}
                      onChange={(e) =>
                        setFormData({ ...formData, website: e.target.value })
                      }
                      placeholder="https://yourwebsite.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-folio-stone-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={3}
                      className="w-full px-4 py-2.5 bg-white/50 border border-folio-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent-500"
                      placeholder="Tell us about your business..."
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  <GlassButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <FaSpinner className="animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create Organization
                        <FaArrowRight className="ml-2" />
                      </>
                    )}
                  </GlassButton>
                </form>
              </GlassCard>
            </motion.div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && createdOrg && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <GlassCard variant="strong" padding="xl" rounded="2xl">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FaCheck className="w-8 h-8 text-green-600" />
                  </div>
                  <EditorialHeadline size="lg" className="mb-3">
                    Organization Created!
                  </EditorialHeadline>
                  <p className="text-folio-stone-600 mb-6">
                    <strong>{createdOrg.name}</strong> has been created. You are
                    now the owner.
                  </p>

                  <div className="bg-folio-stone-50 rounded-lg p-4 mb-6 text-left">
                    <h4 className="font-medium text-folio-ink mb-2">
                      Next steps:
                    </h4>
                    <ul className="space-y-2 text-sm text-folio-stone-600">
                      <li className="flex items-center gap-2">
                        <FaCheck className="text-green-500" />
                        Invite team members to your organization
                      </li>
                      <li className="flex items-center gap-2">
                        <FaCheck className="text-green-500" />
                        Complete your organization profile
                      </li>
                      <li className="flex items-center gap-2">
                        <FaCheck className="text-green-500" />
                        Claim and verify for a verified badge
                      </li>
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <Link href={`/org/${createdOrg.id}`} className="flex-1">
                      <GlassButton variant="primary" size="lg" className="w-full">
                        Go to Organization
                      </GlassButton>
                    </Link>
                    <Link href="/" className="flex-1">
                      <GlassButton variant="secondary" size="lg" className="w-full">
                        Back to Home
                      </GlassButton>
                    </Link>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
