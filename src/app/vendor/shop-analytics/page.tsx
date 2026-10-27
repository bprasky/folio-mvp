'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Image from '@/components/FolioImage';
import Link from 'next/link';
import {
  ShoppingBag,
  Users,
  MessageSquareQuote,
  TrendingUp,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Package,
} from 'lucide-react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface ShopAnalytics {
  overview: {
    totalProducts: number;
    productsInShops: number;
    uniqueDesigners: number;
    totalTestimonials: number;
  };
  boosts: {
    total: number;
    pending: number;
    approved: number;
    declined: number;
    totalInvestment: number;
  };
  topProducts: Array<{
    product: {
      id: string;
      name: string;
      imageUrl: string | null;
      category: string | null;
    } | null;
    shopCount: number;
  }>;
  topDesigners: Array<{
    designer: {
      id: string;
      name: string;
      profileImage: string | null;
      companyName: string | null;
    } | null;
    productCount: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'shop_add';
    designer: {
      id: string;
      name: string;
      profileImage: string | null;
    };
    product: {
      id: string;
      name: string;
      imageUrl: string | null;
    };
    hasQuote: boolean;
    createdAt: string;
  }>;
  timeRange: string;
}

interface Organization {
  id: string;
  name: string;
}

const TIME_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

export default function VendorShopAnalyticsPage() {
  const { data: session } = useSession();
  const [analytics, setAnalytics] = useState<ShopAnalytics | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's vendor organizations
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch('/api/user/organizations?type=VENDOR');
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations || []);
          if (data.organizations?.length > 0) {
            setSelectedOrg(data.organizations[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch organizations:', err);
      }
    }

    if (session?.user?.id) {
      fetchOrganizations();
    }
  }, [session?.user?.id]);

  // Fetch analytics when org or time range changes
  useEffect(() => {
    async function fetchAnalytics() {
      if (!selectedOrg) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          organizationId: selectedOrg,
          timeRange,
        });
        const response = await fetch(`/api/vendor/shop-analytics?${params}`);

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [selectedOrg, timeRange]);

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: '#8B8178' }}>Please sign in to view analytics.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface-ground)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{ color: '#2C2825' }}
            >
              Shop Analytics
            </h1>
            <p className="text-sm mt-1" style={{ color: '#8B8178' }}>
              Track designer engagement with your products
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {organizations.length > 1 && (
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="px-4 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E8E4DF',
                  color: '#2C2825',
                }}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E8E4DF',
                color: '#2C2825',
              }}
            >
              {TIME_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <AnalyticsSkeleton />
        ) : error ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DF' }}
          >
            <p style={{ color: '#8B8178' }}>{error}</p>
          </div>
        ) : !analytics ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DF' }}
          >
            <p style={{ color: '#8B8178' }}>
              Select a vendor organization to view analytics.
            </p>
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={<Package className="w-5 h-5" />}
                label="Products in Shops"
                value={analytics.overview.productsInShops}
                subtext={`of ${analytics.overview.totalProducts} total products`}
                color="#3B82F6"
              />
              <StatCard
                icon={<Users className="w-5 h-5" />}
                label="Designers"
                value={analytics.overview.uniqueDesigners}
                subtext="featuring your products"
                color="#10B981"
              />
              <StatCard
                icon={<MessageSquareQuote className="w-5 h-5" />}
                label="Testimonials"
                value={analytics.overview.totalTestimonials}
                subtext="designer quotes"
                color="#8B5CF6"
              />
              <StatCard
                icon={<Star className="w-5 h-5" />}
                label="Boost Requests"
                value={analytics.boosts.total}
                subtext={`$${analytics.boosts.totalInvestment.toLocaleString()} invested`}
                color="#F59E0B"
              />
            </div>

            {/* Boost Status */}
            {analytics.boosts.total > 0 && (
              <div
                className="rounded-xl p-6 mb-8"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DF' }}
              >
                <h2
                  className="text-lg font-medium mb-4"
                  style={{ color: '#2C2825' }}
                >
                  Boost Status
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Clock className="w-4 h-4" style={{ color: '#F59E0B' }} />
                      <span
                        className="text-2xl font-semibold"
                        style={{ color: '#F59E0B' }}
                      >
                        {analytics.boosts.pending}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: '#8B8178' }}>
                      Pending
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <CheckCircle
                        className="w-4 h-4"
                        style={{ color: '#10B981' }}
                      />
                      <span
                        className="text-2xl font-semibold"
                        style={{ color: '#10B981' }}
                      >
                        {analytics.boosts.approved}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: '#8B8178' }}>
                      Approved
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <XCircle className="w-4 h-4" style={{ color: '#EF4444' }} />
                      <span
                        className="text-2xl font-semibold"
                        style={{ color: '#EF4444' }}
                      >
                        {analytics.boosts.declined}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: '#8B8178' }}>
                      Declined
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Two-column layout for lists */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Top Products */}
              <div
                className="rounded-xl p-6"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DF' }}
              >
                <h2
                  className="text-lg font-medium mb-4"
                  style={{ color: '#2C2825' }}
                >
                  Top Products in Designer Shops
                </h2>
                {analytics.topProducts.length === 0 ? (
                  <p className="text-sm" style={{ color: '#8B8178' }}>
                    No products have been added to designer shops yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.topProducts.map((item, index) =>
                      item.product ? (
                        <div
                          key={item.product.id}
                          className="flex items-center gap-3"
                        >
                          <span
                            className="text-sm font-medium w-5"
                            style={{ color: '#A9A29A' }}
                          >
                            {index + 1}
                          </span>
                          <div
                            className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
                            style={{ backgroundColor: '#F5F3F0' }}
                          >
                            {item.product.imageUrl ? (
                              <Image
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                width={40}
                                height={40}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package
                                  className="w-4 h-4"
                                  style={{ color: '#C4BEB5' }}
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: '#2C2825' }}
                            >
                              {item.product.name}
                            </p>
                            <p className="text-xs" style={{ color: '#8B8178' }}>
                              {item.product.category || 'Uncategorized'}
                            </p>
                          </div>
                          <span
                            className="text-sm font-medium"
                            style={{ color: '#3B82F6' }}
                          >
                            {item.shopCount} shops
                          </span>
                        </div>
                      ) : null
                    )}
                  </div>
                )}
              </div>

              {/* Top Designers */}
              <div
                className="rounded-xl p-6"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DF' }}
              >
                <h2
                  className="text-lg font-medium mb-4"
                  style={{ color: '#2C2825' }}
                >
                  Top Designers
                </h2>
                {analytics.topDesigners.length === 0 ? (
                  <p className="text-sm" style={{ color: '#8B8178' }}>
                    No designers have featured your products yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.topDesigners.map((item, index) =>
                      item.designer ? (
                        <DesignerRow
                          key={item.designer.id || `anon-${index}`}
                          index={index}
                          designer={item.designer}
                          productCount={item.productCount}
                        />
                      ) : null
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div
              className="rounded-xl p-6"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DF' }}
            >
              <h2
                className="text-lg font-medium mb-4"
                style={{ color: '#2C2825' }}
              >
                Recent Activity
              </h2>
              {analytics.recentActivity.length === 0 ? (
                <p className="text-sm" style={{ color: '#8B8178' }}>
                  No recent activity to show.
                </p>
              ) : (
                <div className="space-y-4">
                  {analytics.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-4 py-2 border-b last:border-b-0"
                      style={{ borderColor: '#F5F3F0' }}
                    >
                      {/* Designer avatar */}
                      {activity.designer.profileImage ? (
                        <Image
                          src={activity.designer.profileImage}
                          alt={activity.designer.name || 'Designer'}
                          width={32}
                          height={32}
                          className="rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: '#E8E4DF' }}
                        >
                          <span
                            className="text-xs font-medium"
                            style={{ color: '#8B8178' }}
                          >
                            {(activity.designer.name || 'D')
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Activity text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ color: '#2C2825' }}>
                          {activity.designer.id ? (
                            <Link
                              href={`/designer/${activity.designer.id}?tab=shop`}
                              className="font-medium hover:underline"
                            >
                              {activity.designer.name || 'A designer'}
                            </Link>
                          ) : (
                            <span className="font-medium">
                              {activity.designer.name || 'A designer'}
                            </span>
                          )}{' '}
                          added{' '}
                          <span className="font-medium">
                            {activity.product.name}
                          </span>{' '}
                          to their shop
                          {activity.hasQuote && (
                            <span style={{ color: '#8B5CF6' }}>
                              {' '}
                              with testimonial
                            </span>
                          )}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#A9A29A' }}>
                          {new Date(activity.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            }
                          )}
                        </p>
                      </div>

                      {/* Product thumbnail */}
                      <div
                        className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
                        style={{ backgroundColor: '#F5F3F0' }}
                      >
                        {activity.product.imageUrl ? (
                          <Image
                            src={activity.product.imageUrl}
                            alt={activity.product.name}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package
                              className="w-4 h-4"
                              style={{ color: '#C4BEB5' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtext: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DF' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div style={{ color }}>{icon}</div>
        <span className="text-sm" style={{ color: '#8B8178' }}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold mb-1" style={{ color: '#2C2825' }}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs" style={{ color: '#A9A29A' }}>
        {subtext}
      </p>
    </div>
  );
}

function DesignerRow({
  index,
  designer,
  productCount,
}: {
  index: number;
  designer: {
    id: string | null;
    name: string;
    profileImage: string | null;
    companyName?: string | null;
  };
  productCount: number;
}) {
  const content = (
    <>
      <span
        className="text-sm font-medium w-5"
        style={{ color: '#A9A29A' }}
      >
        {index + 1}
      </span>
      {designer.profileImage ? (
        <Image
          src={designer.profileImage}
          alt={designer.name || 'Designer'}
          width={40}
          height={40}
          className="rounded-full object-cover"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#E8E4DF' }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: '#8B8178' }}
          >
            {(designer.name || 'D').charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: '#2C2825' }}
        >
          {designer.name || 'Anonymous'}
        </p>
        {designer.companyName && (
          <p
            className="text-xs truncate"
            style={{ color: '#8B8178' }}
          >
            {designer.companyName}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span
          className="text-sm font-medium"
          style={{ color: '#10B981' }}
        >
          {productCount} products
        </span>
        {designer.id && (
          <ArrowUpRight
            className="w-3 h-3"
            style={{ color: '#A9A29A' }}
          />
        )}
      </div>
    </>
  );

  // Only link if designer has an ID (not anonymous)
  if (designer.id) {
    return (
      <Link
        href={`/designer/${designer.id}?tab=shop`}
        className="flex items-center gap-3 hover:bg-surface-ground -mx-2 px-2 py-1 rounded-lg transition-colors"
      >
        {content}
      </Link>
    );
  }

  // Non-clickable row for anonymous designers
  return (
    <div className="flex items-center gap-3 -mx-2 px-2 py-1">
      {content}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Overview cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl p-4 animate-pulse"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DF' }}
          >
            <div
              className="h-4 w-20 rounded mb-3"
              style={{ backgroundColor: '#E8E4DF' }}
            />
            <div
              className="h-8 w-16 rounded mb-2"
              style={{ backgroundColor: '#E8E4DF' }}
            />
            <div
              className="h-3 w-24 rounded"
              style={{ backgroundColor: '#E8E4DF' }}
            />
          </div>
        ))}
      </div>

      {/* Lists skeleton */}
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl p-6 animate-pulse"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DF' }}
          >
            <div
              className="h-5 w-40 rounded mb-4"
              style={{ backgroundColor: '#E8E4DF' }}
            />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg"
                    style={{ backgroundColor: '#E8E4DF' }}
                  />
                  <div className="flex-1">
                    <div
                      className="h-4 w-32 rounded mb-1"
                      style={{ backgroundColor: '#E8E4DF' }}
                    />
                    <div
                      className="h-3 w-20 rounded"
                      style={{ backgroundColor: '#E8E4DF' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
