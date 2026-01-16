/**
 * DESIGNER PROFILE DATA MODEL
 * 
 * - Projects shown here are the same "published projects" used in the global/project feed.
 * - A project is associated to a designer via Project.designerId -> User.id.
 * - Projects are considered "published" if isPublic: true OR publishedAt: { not: null } OR status: 'published'.
 * - "Known For Products" is derived from tagged products across this designer's published projects.
 * - ProductTag links ProjectImage -> Product, and ProjectImage belongs to Project.
 * 
 * This page displays the logged-in designer's own profile with:
 * - Published projects only (portfolio showcase)
 * - Top 10 most-tagged products from published projects
 * - Private analytics (visible only to designer/admin)
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  FaInstagram, FaGlobe, FaEnvelope, FaPhone,
  FaEdit, FaSave, FaTimes, FaCheckCircle
} from 'react-icons/fa';
import EditorialBio from '@/components/atelier/EditorialBio';
import InfluenceMetrics from '@/components/atelier/InfluenceMetrics';
import FolioFingerprint from '@/components/atelier/FolioFingerprint';
import KnownForProducts from '@/components/atelier/KnownForProducts';
import EditorialMosaic from '@/components/atelier/EditorialMosaic';
import DesignerCTAs from '@/components/atelier/DesignerCTAs';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const defaultDesignerData = {
  name: '',
  title: '',
  location: '',
  studio: '',
  bio: '',
  profileImage: '/images/product-placeholder.jpg',
  website: '',
  instagram: '',
  phone: '',
  email: '',
  followers: 0,
  following: 0,
  projects: '0',
  featuredProjects: [],
  metrics: {
    totalTaggedProducts: 0,
    influenceValue: 0,
    atelierOrders: 0,
    vendorPartnerships: 0,
  },
  topProducts: [],
  styleDescriptors: [],
};

export default function DesignerProfile() {
  const { data: session } = useSession();
  const [designerData, setDesignerData] = useState<any>(defaultDesignerData);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { scrollY } = useScroll();
  const sidebarY = useTransform(scrollY, [0, 1000], [0, -100]);

  // Load designer profile from database
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/designer/profile', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        if (response.ok) {
          const data = await response.json();
          setDesignerData({
            ...defaultDesignerData,
            ...data,
            featuredProjects: data.featuredProjects || [],
            metrics: data.metrics || defaultDesignerData.metrics,
            topProducts: data.topProducts || [],
            styleDescriptors: data.styleDescriptors || [],
          });
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[DesignerProfile] Loaded:', {
              projects: data.featuredProjects?.length || 0,
              metrics: data.metrics,
              topProducts: data.topProducts?.length || 0,
            });
          }
        } else {
          console.error('Failed to load profile');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [session]);

  // Save profile changes
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/designer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: designerData.name,
          title: designerData.title,
          bio: designerData.bio,
          location: designerData.location,
          studio: designerData.studio,
          phone: designerData.phone,
          website: designerData.website,
          instagram: designerData.instagram,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        // Reload profile to get fresh data
        const loadProfile = async () => {
          const res = await fetch('/api/designer/profile', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            setDesignerData({
              ...defaultDesignerData,
              ...data,
              featuredProjects: data.featuredProjects || [],
              metrics: data.metrics || defaultDesignerData.metrics,
              topProducts: data.topProducts || [],
              styleDescriptors: data.styleDescriptors || [],
            });
          }
        };
        loadProfile();
      } else {
        alert('Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  // Check if user can see analytics (own profile or admin)
  const canSeeAnalytics = session?.user?.id === designerData.id || 
    (session?.user as any)?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Sticky Sidebar */}
          <motion.aside
            className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start"
            style={{ y: sidebarY }}
          >
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <RidgeCard padding="lg" className="mb-8">
              {/* Edit/Save Buttons */}
              <div className="flex justify-end mb-6">
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      <FaSave className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ridge"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      <FaTimes className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ridge"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <FaEdit className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Profile Image */}
              <motion.div
                className="relative w-32 h-32 mx-auto mb-6"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <Image
                  src={designerData.profileImage || '/images/product-placeholder.jpg'}
                  alt={designerData.name || 'Designer'}
                  fill
                  className="rounded-full object-cover shadow-[var(--neu-raised)]"
                />
              </motion.div>

              {/* Name & Badges */}
              <div className="text-center mb-6">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      type="text"
                      variant="ridge"
                      value={designerData.name || ''}
                      onChange={(e) => setDesignerData({ ...designerData, name: e.target.value })}
                      className="w-full text-center folio-h2"
                      placeholder="Your Name"
                    />
                    <Input
                      type="text"
                      variant="ridge"
                      value={designerData.title || ''}
                      onChange={(e) => setDesignerData({ ...designerData, title: e.target.value })}
                      className="w-full text-center"
                      placeholder="Your Title"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <h1 className="folio-h2 text-[var(--text-primary)]">{designerData.name || 'Your Name'}</h1>
                      <span className="px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium rounded-full border border-[var(--accent)]/20">
                        Folio Atelier
                      </span>
                    </div>
                    {designerData.title && (
                      <p className="folio-body text-[var(--text-secondary)] mb-2">{designerData.title}</p>
                    )}
                    {designerData.location && (
                      <p className="folio-meta">{designerData.location}</p>
                    )}

                    {/* Atelier Model Indicators */}
                    <div className="mt-4 flex flex-col gap-2 items-center">
                      <div className="flex items-center gap-2 px-3 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-full">
                        <FaCheckCircle className="w-3 h-3 text-[var(--accent)]" />
                        <span className="text-xs text-[var(--accent)]">Atelier Model: Active</span>
                      </div>
                      <div className="px-3 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full">
                        <span className="folio-meta">Surge Pricing Enabled</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-6 border-t border-[var(--border-subtle)] pt-6">
                {isEditing ? (
                  <>
                    <div className="flex items-center gap-3">
                      <FaEnvelope className="w-4 h-4 text-[var(--accent)]" />
                      <Input
                        type="email"
                        variant="ridge"
                        value={designerData.email || ''}
                        onChange={(e) => setDesignerData({ ...designerData, email: e.target.value })}
                        className="flex-1 text-sm"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <FaPhone className="w-4 h-4 text-[var(--accent)]" />
                      <Input
                        type="tel"
                        variant="ridge"
                        value={designerData.phone || ''}
                        onChange={(e) => setDesignerData({ ...designerData, phone: e.target.value })}
                        className="flex-1 text-sm"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {designerData.email && (
                      <a
                        href={`mailto:${designerData.email}`}
                        className="flex items-center gap-3 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors text-sm"
                      >
                        <FaEnvelope className="w-4 h-4" />
                        <span>{designerData.email}</span>
                      </a>
                    )}
                    {designerData.phone && (
                      <a
                        href={`tel:${designerData.phone}`}
                        className="flex items-center gap-3 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors text-sm"
                      >
                        <FaPhone className="w-4 h-4" />
                        <span>{designerData.phone}</span>
                      </a>
                    )}
                  </>
                )}
              </div>

              {/* Social Links */}
              <div className="flex gap-4 justify-center border-t border-[var(--border-subtle)] pt-6 mb-6">
                {designerData.instagram && (
                  <a
                    href={designerData.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                  >
                    <FaInstagram className="w-5 h-5" />
                  </a>
                )}
                {designerData.website && (
                  <a
                    href={designerData.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                  >
                    <FaGlobe className="w-5 h-5" />
                  </a>
                )}
              </div>

              {/* CTAs - Moved under profile card */}
              <DesignerCTAs />

              {/* Analytics Section - Only visible to designer or admin */}
              {canSeeAnalytics && (
                <div className="mt-8 pt-8 border-t border-[var(--border-subtle)]">
                  <h3 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-4">
                    Analytics
                  </h3>
                  <InfluenceMetrics
                    totalTaggedProducts={designerData.metrics?.totalTaggedProducts || 0}
                    influenceValue={designerData.metrics?.influenceValue || 0}
                    atelierOrders={designerData.metrics?.atelierOrders || 0}
                    vendorPartnerships={designerData.metrics?.vendorPartnerships || 0}
                  />
                </div>
              )}
              </RidgeCard>
            </motion.div>
          </motion.aside>

          {/* Main Content Area */}
          <main className="lg:col-span-8 space-y-12">
            {/* Editorial Bio */}
            <EditorialBio
              name={designerData.name || 'Designer'}
              bio={designerData.bio}
              title={designerData.title}
            />

            {/* Folio Fingerprint - Replaces Taste DNA Snapshot */}
            <FolioFingerprint descriptors={designerData.styleDescriptors} />

            {/* Known For Products */}
            <KnownForProducts products={designerData.topProducts || []} />

            {/* Editorial Mosaic - Projects */}
            <div className="mb-12">
              <div className="mb-8">
                <h2 className="folio-h1 text-[var(--text-primary)] mb-2">Projects</h2>
                <p className="folio-meta">Editorial showcase of completed work</p>
              </div>
              <EditorialMosaic projects={designerData.featuredProjects || []} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}