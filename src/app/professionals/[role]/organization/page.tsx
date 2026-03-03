'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaSearch,
  FaBuilding,
  FaCheck,
  FaArrowLeft,
  FaArrowRight,
  FaSpinner,
  FaPlus,
  FaGlobe,
  FaEnvelope,
} from 'react-icons/fa';
import { EditorialHeadline } from '@/components/ui/glass';

type ViewState = 'search' | 'create' | 'success';

interface OrgSearchResult {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  website?: string;
  address?: string;
  _count: {
    users: number;
  };
}

interface CreatedOrg {
  id: string;
  name: string;
  type: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function OrganizationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const role = params.role as string;

  // Validate role parameter - now includes architect and builder
  const isValidRole = role === 'designer' || role === 'vendor' || role === 'architect' || role === 'builder';

  const [view, setView] = useState<ViewState>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrgSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdOrg, setCreatedOrg] = useState<CreatedOrg | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Form state for creating new org
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    workEmail: '',
  });

  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Get org type options based on role
  const getOrgTypeOptions = () => {
    if (role === 'designer') {
      return [{ value: 'DESIGN_FIRM', label: 'Design Firm' }];
    }
    if (role === 'architect') {
      return [{ value: 'ARCHITECTURE_FIRM', label: 'Architecture Firm' }];
    }
    if (role === 'builder') {
      return [{ value: 'CONTRACTOR', label: 'General Contractor / Builder' }];
    }
    // Vendor role
    return [
      { value: 'VENDOR', label: 'Vendor' },
      { value: 'MANUFACTURER', label: 'Manufacturer' },
      { value: 'SHOWROOM', label: 'Showroom' },
    ];
  };

  const [selectedOrgType, setSelectedOrgType] = useState('DESIGN_FIRM');

  // Sync org type with role when it becomes available
  useEffect(() => {
    if (role === 'designer') {
      setSelectedOrgType('DESIGN_FIRM');
    } else if (role === 'architect') {
      setSelectedOrgType('ARCHITECTURE_FIRM');
    } else if (role === 'builder') {
      setSelectedOrgType('CONTRACTOR');
    } else {
      setSelectedOrgType('VENDOR');
    }
  }, [role]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=/professionals/${role}/organization`);
    }
  }, [status, router, role]);

  // Redirect if invalid role
  useEffect(() => {
    if (!isValidRole && status !== 'loading') {
      router.push('/professionals');
    }
  }, [isValidRole, router, status]);

  // Auto-search as user types
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchQuery.trim() || debouncedSearchQuery.trim().length < 2) {
        if (debouncedSearchQuery.trim().length === 0) {
          setSearchResults([]);
          setHasSearched(false);
        }
        return;
      }

      setIsSearching(true);
      setError('');
      setHasSearched(true);

      try {
        // Map role to org type filter for search
        let typeFilter = 'VENDOR';
        if (role === 'designer') typeFilter = 'DESIGNER';
        else if (role === 'architect') typeFilter = 'ARCHITECT';
        else if (role === 'builder') typeFilter = 'BUILDER';

        const response = await fetch(
          `/api/orgs/search?q=${encodeURIComponent(debouncedSearchQuery)}&type=${typeFilter}`
        );

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        setSearchResults(data.organizations || []);
      } catch (err) {
        setError('Failed to search organizations');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery, role]);

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
      const response = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          type: selectedOrgType,
          website: formData.website || undefined,
          workEmail: formData.workEmail || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.debug || 'Failed to create organization');
      }

      // Hard redirect to projects - forces full session refresh with updated role
      window.location.href = '/projects';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (status === 'loading' || !isValidRole) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#FAF8F5' }}
      >
        <FaSpinner className="w-8 h-8 animate-spin text-folio-stone-400" />
      </div>
    );
  }

  // Get human-readable role label
  const getRoleLabel = () => {
    switch (role) {
      case 'designer': return 'Interior Designer';
      case 'architect': return 'Architect';
      case 'builder': return 'Builder';
      case 'vendor': return 'Vendor';
      default: return 'Professional';
    }
  };
  const roleLabel = getRoleLabel();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
        {/* Back Button */}
        {view !== 'success' && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => {
              if (view === 'create') {
                setView('search');
              } else {
                router.push('/professionals');
              }
            }}
            className="flex items-center gap-2 text-folio-stone-600 hover:text-folio-ink mb-8 font-sans transition-colors"
          >
            <FaArrowLeft className="w-3 h-3" />
            <span>{view === 'create' ? 'Back to search' : 'Back'}</span>
          </motion.button>
        )}

        <AnimatePresence mode="wait">
          {/* Search View */}
          {view === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Header */}
              <div className="text-center mb-10">
                <EditorialHeadline
                  as="h1"
                  size="lg"
                  className="mb-4 text-folio-ink"
                >
                  Find or Create Your Organization
                </EditorialHeadline>
                <p className="font-sans text-folio-stone-600 text-lg max-w-lg mx-auto">
                  Folio organizes professionals by studio or company. Search for your organization or create a new one.
                </p>
              </div>

              {/* Search Section */}
              <div className="bg-white rounded-[20px] border border-folio-stone-100 p-6 md:p-8 shadow-sm">
                {/* Search Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    {isSearching ? (
                      <FaSpinner className="w-5 h-5 text-folio-stone-400 animate-spin" />
                    ) : (
                      <FaSearch className="w-5 h-5 text-folio-stone-400" />
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Search for your studio or company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 text-lg font-sans bg-folio-stone-100/50 border border-folio-stone-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-folio-stone-300 focus:border-transparent placeholder:text-folio-stone-400 transition-all"
                    autoFocus
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-sans text-sm">
                    {error}
                  </div>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm font-sans text-folio-stone-500">
                      {searchResults.length} organization{searchResults.length !== 1 ? 's' : ''} found
                    </p>
                    {searchResults.map((org) => (
                      <div
                        key={org.id}
                        className="flex items-center justify-between p-4 bg-folio-stone-100/30 rounded-xl border border-folio-stone-100 hover:border-folio-stone-200 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-folio-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <FaBuilding className="text-folio-stone-500 w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-sans font-medium text-folio-ink truncate">
                              {org.name}
                            </h3>
                            <p className="text-sm font-sans text-folio-stone-500">
                              {org._count.users} member{org._count.users !== 1 ? 's' : ''}
                              {org.address && (
                                <>
                                  <span className="mx-1">·</span>
                                  {org.address}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleJoinRequest(org.id)}
                          disabled={isSubmitting}
                          className="flex-shrink-0 px-4 py-2 text-sm font-sans font-medium text-folio-ink bg-white border border-folio-stone-200 rounded-full hover:bg-folio-stone-100 transition-colors disabled:opacity-50"
                        >
                          {isSubmitting ? 'Requesting...' : 'Request to Join'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* No Results Message */}
                {hasSearched && searchResults.length === 0 && !isSearching && searchQuery.trim() && !error && (
                  <p className="mt-6 text-center font-sans text-folio-stone-500">
                    No organizations found matching "{searchQuery}"
                  </p>
                )}

                {/* Create New Org Link */}
                <div className="mt-8 pt-6 border-t border-folio-stone-100">
                  <button
                    onClick={() => {
                      // Pre-fill org name if user searched
                      if (searchQuery.trim()) {
                        setFormData((prev) => ({ ...prev, name: searchQuery.trim() }));
                      }
                      setError(''); // Clear any search errors
                      setView('create');
                    }}
                    className="w-full flex items-center justify-center gap-3 p-4 text-folio-stone-600 hover:text-folio-ink font-sans border-2 border-dashed border-folio-stone-200 rounded-xl hover:border-folio-stone-300 transition-colors"
                  >
                    <FaPlus className="w-4 h-4" />
                    <span>Can't find your organization? Create a new one</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Create View */}
          {view === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Header */}
              <div className="text-center mb-10">
                <EditorialHeadline
                  as="h1"
                  size="lg"
                  className="mb-4 text-folio-ink"
                >
                  Create Your Organization
                </EditorialHeadline>
                <p className="font-sans text-folio-stone-600 text-lg max-w-lg mx-auto">
                  Set up your organization profile. You can add more details later.
                </p>
              </div>

              {/* Create Form */}
              <div className="bg-white rounded-[20px] border border-folio-stone-100 p-6 md:p-8 shadow-sm">
                <form onSubmit={handleCreateOrg} className="space-y-6">
                  {/* Organization Name */}
                  <div>
                    <label className="block text-sm font-sans font-medium text-folio-stone-700 mb-2">
                      Organization Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Your studio or company name"
                      className="w-full px-4 py-3 font-sans bg-folio-stone-100/50 border border-folio-stone-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-folio-stone-300 focus:border-transparent placeholder:text-folio-stone-400"
                    />
                  </div>

                  {/* Work Email */}
                  <div>
                    <label className="block text-sm font-sans font-medium text-folio-stone-700 mb-2">
                      Your Work Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <FaEnvelope className="w-4 h-4 text-folio-stone-400" />
                      </div>
                      <input
                        type="email"
                        required
                        value={formData.workEmail}
                        onChange={(e) =>
                          setFormData({ ...formData, workEmail: e.target.value })
                        }
                        placeholder="you@company.com"
                        className="w-full pl-11 pr-4 py-3 font-sans bg-folio-stone-100/50 border border-folio-stone-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-folio-stone-300 focus:border-transparent placeholder:text-folio-stone-400"
                      />
                    </div>
                    <p className="mt-1.5 text-xs font-sans text-folio-stone-500">
                      This email will be associated with your organization membership
                    </p>
                  </div>

                  {/* Organization Type (for roles with multiple options) */}
                  {role === 'vendor' && getOrgTypeOptions().length > 1 && (
                    <div>
                      <label className="block text-sm font-sans font-medium text-folio-stone-700 mb-2">
                        Organization Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedOrgType}
                        onChange={(e) => setSelectedOrgType(e.target.value)}
                        className="w-full px-4 py-3 font-sans bg-folio-stone-100/50 border border-folio-stone-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-folio-stone-300 focus:border-transparent"
                      >
                        {getOrgTypeOptions().map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Website (optional) */}
                  <div>
                    <label className="block text-sm font-sans font-medium text-folio-stone-700 mb-2">
                      Website
                      <span className="text-folio-stone-400 font-normal ml-1">(optional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <FaGlobe className="w-4 h-4 text-folio-stone-400" />
                      </div>
                      <input
                        type="text"
                        value={formData.website}
                        onChange={(e) =>
                          setFormData({ ...formData, website: e.target.value })
                        }
                        placeholder="yourwebsite.com"
                        className="w-full pl-11 pr-4 py-3 font-sans bg-folio-stone-100/50 border border-folio-stone-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-folio-stone-300 focus:border-transparent placeholder:text-folio-stone-400"
                      />
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-sans text-sm">
                      {error}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.name.trim() || !formData.workEmail.trim()}
                    className="w-full py-4 px-6 rounded-full bg-folio-ink text-white font-sans font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <FaSpinner className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create Organization
                        <FaArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* Success View */}
          {view === 'success' && createdOrg && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="bg-white rounded-[20px] border border-folio-stone-100 p-8 md:p-12 shadow-sm text-center">
                {/* Success Icon */}
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FaCheck className="w-7 h-7 text-emerald-600" />
                </div>

                {/* Success Message */}
                <EditorialHeadline
                  as="h1"
                  size="md"
                  className="mb-3 text-folio-ink"
                >
                  You're all set!
                </EditorialHeadline>
                <p className="font-sans text-folio-stone-600 text-lg mb-8">
                  <strong className="text-folio-ink">{createdOrg.name}</strong> has been created.
                  You are now the owner.
                </p>

                {/* Next Steps */}
                <div className="bg-folio-stone-100/30 rounded-xl p-6 mb-8 text-left">
                  <h3 className="font-sans font-medium text-folio-ink mb-3">
                    What's next:
                  </h3>
                  <ul className="space-y-2 font-sans text-folio-stone-600">
                    <li className="flex items-start gap-3">
                      <FaCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>Complete your organization profile</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <FaCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>Invite team members to join</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <FaCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>Start creating projects</span>
                    </li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href={`/org/${createdOrg.id}`} className="flex-1">
                    <button className="w-full py-3.5 px-6 rounded-full bg-folio-ink text-white font-sans font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-colors">
                      Go to Organization
                      <FaArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                  <Link href="/" className="flex-1">
                    <button className="w-full py-3.5 px-6 rounded-full bg-white text-folio-ink font-sans font-medium border border-folio-stone-200 hover:bg-folio-stone-100 transition-colors">
                      Browse Folio
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
