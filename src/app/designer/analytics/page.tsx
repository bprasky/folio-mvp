'use client';

import { useState } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import designerAnalyticsData from '@/data/designer_analytics.json';
import designerProjectsData from '@/data/designer_projects.json';
import { FaEye, FaUsers, FaFolder, FaTag, FaDollarSign, FaRocket, FaTimes, FaComment, FaNewspaper, FaPrint, FaRegNewspaper } from 'react-icons/fa';
import { RidgeCard, StatsCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

interface ProductMetrics {
  product_name: string;
  product_image: string;
  views_from_designer: number;
  saves_from_designer: number;
  outbound_clicks_from_designer: number;
  events_featured_in: string[];
}

interface DesignerAnalyticsData {
  designer_name: string;
  profile_image: string;
  profile_views_total: number;
  followers_total: number;
  projects_saved_total: number;
  products_tagged_total: number;
  earnings_pending: string;
  top_tagged_products: ProductMetrics[];
}

interface TaggedProductInProject {
  product_name: string;
  product_image: string;
  views_from_project: number;
  saves_from_project: number;
  outbound_clicks_from_project: number;
}

interface Comment {
  username: string;
  comment_text: string;
}

interface Project {
  project_name: string;
  project_image: string;
  total_views: number;
  project_saves: number;
  comments: Comment[];
  products_tagged: TaggedProductInProject[];
  eligible_for_editorial: boolean;
  eligible_for_print: boolean;
}

export default function DesignerAnalyticsPage() {
  const productData: DesignerAnalyticsData = designerAnalyticsData;
  const projectsData: Project[] = designerProjectsData;

  const [activeTab, setActiveTab] = useState<'product' | 'project' | 'opportunities'>('project');
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostedItem, setBoostedItem] = useState<{ type: 'product' | 'project'; name: string } | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<{ [key: string]: boolean }>({});

  const toggleProjectDetails = (projectName: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectName]: !prev[projectName]
    }));
  };

  const handleBoostClick = (type: 'product' | 'project', name: string) => {
    setBoostedItem({ type, name });
    setShowBoostModal(true);
    setShowConfirmation(false);
  };

  const confirmBoost = () => {
    console.log(`Boosting ${boostedItem?.type}: ${boostedItem?.name}`);
    setShowConfirmation(true);
    setTimeout(() => {
      setShowBoostModal(false);
      setShowConfirmation(false);
      setBoostedItem(null);
    }, 2000);
  };

  const handleSubmitForReview = (project: Project, type: 'editorial' | 'print') => {
    console.log(`Submitting project '${project.project_name}' for ${type} review.`);
    alert(`Request to submit '${project.project_name}' for ${type} review sent!`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-8 lg:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Designer Overview Header */}
        <div className="mb-10 flex flex-col md:flex-row items-center md:justify-between">
          <div className="flex items-center mb-6 md:mb-0">
            <SafeImage
              src={productData.profile_image}
              alt={productData.designer_name}
              width={96}
              height={96}
              className="rounded-full border-4 border-[var(--accent)] object-cover mr-6"
            />
            <div>
              <h1 className="folio-h1 text-[var(--accent)] mb-1">{productData.designer_name}</h1>
              <p className="folio-body text-[var(--text-secondary)]">Your Analytics Dashboard</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-center w-full md:w-auto">
            <div className="ridge-card p-4">
              <FaEye className="text-3xl text-[var(--accent)] mx-auto mb-2" />
              <p className="stats-value">{productData.profile_views_total}</p>
              <p className="stats-label">Profile Views</p>
            </div>
            <div className="ridge-card p-4">
              <FaUsers className="text-3xl text-purple-500 mx-auto mb-2" />
              <p className="stats-value">{productData.followers_total}</p>
              <p className="stats-label">Followers</p>
            </div>
            <div className="ridge-card p-4">
              <FaFolder className="text-3xl text-green-500 mx-auto mb-2" />
              <p className="stats-value">{productData.projects_saved_total}</p>
              <p className="stats-label">Projects Saved</p>
            </div>
            <div className="ridge-card p-4">
              <FaTag className="text-3xl text-red-500 mx-auto mb-2" />
              <p className="stats-value">{productData.products_tagged_total}</p>
              <p className="stats-label">Products Tagged</p>
            </div>
            <div className="ridge-card p-4 col-span-2 lg:col-span-1">
              <FaDollarSign className="text-3xl text-[var(--accent)] mx-auto mb-2" />
              <p className="stats-value">{productData.earnings_pending}</p>
              <p className="stats-label">Pending Earnings</p>
            </div>
          </div>
        </div>

        {/* Analytics Tabs */}
        <div className="flex space-x-2 mb-8 p-1 bg-[var(--bg-elevated)] rounded-xl">
          <button
            className={`px-4 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'product'
                ? 'bg-[var(--bg-base)] text-[var(--accent)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            onClick={() => setActiveTab('product')}
          >
            Product Engagement
          </button>
          <button
            className={`px-4 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'project'
                ? 'bg-[var(--bg-base)] text-[var(--accent)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            onClick={() => setActiveTab('project')}
          >
            Project Performance
          </button>
          <button
            className={`px-4 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'opportunities'
                ? 'bg-[var(--bg-base)] text-[var(--accent)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            onClick={() => setActiveTab('opportunities')}
          >
            Opportunities
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'product' && (
          <RidgeCard padding="lg" className="mb-10">
            <h2 className="folio-h2 text-[var(--accent)] mb-6">Product Engagement Leaderboard</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left table-auto">
                <thead>
                  <tr className="bg-[var(--bg-elevated)]">
                    <th className="px-4 py-3 rounded-tl-lg text-[var(--text-primary)] folio-body font-semibold">Product</th>
                    <th className="px-4 py-3 text-[var(--text-primary)] folio-body font-semibold">Views</th>
                    <th className="px-4 py-3 text-[var(--text-primary)] folio-body font-semibold">Saves</th>
                    <th className="px-4 py-3 text-[var(--text-primary)] folio-body font-semibold">Clicks</th>
                    <th className="px-4 py-3 text-[var(--text-primary)] folio-body font-semibold">Events</th>
                    <th className="px-4 py-3 rounded-tr-lg text-[var(--text-primary)] folio-body font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {productData.top_tagged_products.map((product, index) => (
                    <tr key={index} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/50">
                      <td className="px-4 py-4 flex items-center">
                        <SafeImage
                          src={product.product_image}
                          alt={product.product_name}
                          width={48}
                          height={48}
                          className="rounded-md object-cover mr-3"
                        />
                        <Link
                          href={`#/product/${product.product_name.toLowerCase().replace(/\s/g, '-')}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                        >
                          {product.product_name}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-[var(--text-primary)]">{product.views_from_designer}</td>
                      <td className="px-4 py-4 text-[var(--text-primary)]">{product.saves_from_designer}</td>
                      <td className="px-4 py-4 text-[var(--text-primary)]">{product.outbound_clicks_from_designer}</td>
                      <td className="px-4 py-4">
                        {product.events_featured_in.length > 0 ? (
                          <ul className="list-disc list-inside text-[var(--text-secondary)]">
                            {product.events_featured_in.map((event, i) => (
                              <li key={i}>{event}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={() => handleBoostClick('product', product.product_name)}
                          className="flex items-center"
                        >
                          <FaRocket className="mr-2" /> Boost Product
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RidgeCard>
        )}

        {activeTab === 'project' && (
          <RidgeCard padding="lg" className="mb-10">
            <h2 className="folio-h2 text-[var(--accent)] mb-6">Project Performance Leaderboard</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left table-auto">
                <thead>
                  <tr className="bg-[var(--bg-elevated)]">
                    <th className="px-4 py-3 rounded-tl-lg text-[var(--text-primary)] folio-body font-semibold">Project</th>
                    <th className="px-4 py-3 text-[var(--text-primary)] folio-body font-semibold">Views</th>
                    <th className="px-4 py-3 text-[var(--text-primary)] folio-body font-semibold">Saves</th>
                    <th className="px-4 py-3 text-[var(--text-primary)] folio-body font-semibold">Top Comment</th>
                    <th className="px-4 py-3 text-[var(--text-primary)] folio-body font-semibold">Products Tagged</th>
                    <th className="px-4 py-3 rounded-tr-lg text-[var(--text-primary)] folio-body font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsData.map((project, index) => (
                    <>
                      <tr key={index} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/50">
                        <td className="px-4 py-4 flex items-center">
                          <button
                            onClick={() => toggleProjectDetails(project.project_name)}
                            className="mr-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            {expandedProjects[project.project_name] ? '▼' : '▶'}
                          </button>
                          <SafeImage
                            src={project.project_image}
                            alt={project.project_name}
                            width={48}
                            height={48}
                            className="rounded-md object-cover mr-3"
                          />
                          <span className="font-medium text-[var(--text-primary)]">{project.project_name}</span>
                        </td>
                        <td className="px-4 py-4 text-[var(--text-primary)]">{project.total_views}</td>
                        <td className="px-4 py-4 text-[var(--text-primary)]">{project.project_saves}</td>
                        <td className="px-4 py-4">
                          {project.comments.length > 0 ? (
                            <span className="text-[var(--text-secondary)] text-sm italic">"{project.comments[0].comment_text}"</span>
                          ) : (
                            <span className="text-[var(--text-tertiary)]">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {project.products_tagged.length > 0 ? (
                            <span className="text-[var(--text-secondary)] text-sm">
                              {project.products_tagged.length} products
                            </span>
                          ) : (
                            <span className="text-[var(--text-tertiary)]">None</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            variant="accent"
                            size="sm"
                            onClick={() => handleBoostClick('project', project.project_name)}
                            className="flex items-center"
                          >
                            <FaRocket className="mr-2" /> Boost Project
                          </Button>
                        </td>
                      </tr>
                      {expandedProjects[project.project_name] && (
                        <tr className="bg-[var(--bg-elevated)]">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <h3 className="folio-h3 text-[var(--accent)] mb-3">Tagged Products</h3>
                                <div className="space-y-3">
                                  {project.products_tagged.map((product, i) => (
                                    <div key={i} className="flex items-center ridge-card p-3">
                                      <SafeImage
                                        src={product.product_image}
                                        alt={product.product_name}
                                        width={40}
                                        height={40}
                                        className="rounded-md object-cover mr-3"
                                      />
                                      <div>
                                        <p className="font-medium text-[var(--text-primary)]">{product.product_name}</p>
                                        <p className="folio-meta">
                                          Views: {product.views_from_project} | Saves: {product.saves_from_project} | Clicks: {product.outbound_clicks_from_project}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h3 className="folio-h3 text-[var(--accent)] mb-3">Project Engagement</h3>
                                <div className="ridge-card p-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="stats-label">Total Views</p>
                                      <p className="stats-value">{project.total_views}</p>
                                    </div>
                                    <div>
                                      <p className="stats-label">Total Saves</p>
                                      <p className="stats-value">{project.project_saves}</p>
                                    </div>
                                    <div>
                                      <p className="stats-label">Products Tagged</p>
                                      <p className="stats-value">{project.products_tagged.length}</p>
                                    </div>
                                    <div>
                                      <p className="stats-label">Comments</p>
                                      <p className="stats-value">{project.comments.length}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </RidgeCard>
        )}

        {activeTab === 'opportunities' && (
          <RidgeCard padding="lg" className="mb-10">
            <h2 className="folio-h2 text-[var(--accent)] mb-6">Editorial & Print Opportunities</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left table-auto">
                <thead>
                  <tr className="bg-[var(--bg-elevated)]">
                    <th className="px-4 py-3 rounded-tl-lg text-[var(--text-primary)] folio-body font-semibold">Project</th>
                    <th className="px-4 py-3 text-[var(--text-primary)] folio-body font-semibold">Eligibility</th>
                    <th className="px-4 py-3 rounded-tr-lg text-[var(--text-primary)] folio-body font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsData.map((project, index) => (
                    <tr key={index} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/50">
                      <td className="px-4 py-4 flex items-center">
                        <SafeImage
                          src={project.project_image}
                          alt={project.project_name}
                          width={48}
                          height={48}
                          className="rounded-md object-cover mr-3"
                        />
                        <span className="font-medium text-[var(--text-primary)]">{project.project_name}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col space-y-2">
                          {project.eligible_for_editorial && (
                            <span className="inline-flex items-center bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                              <FaNewspaper className="mr-1" /> Editorial Eligible
                            </span>
                          )}
                          {project.eligible_for_print && (
                            <span className="inline-flex items-center bg-[var(--accent)]/10 text-[var(--accent-hover)] text-xs font-semibold px-2.5 py-1 rounded-full">
                              <FaPrint className="mr-1" /> Print Eligible
                            </span>
                          )}
                          {!project.eligible_for_editorial && !project.eligible_for_print && (
                            <span className="text-[var(--text-tertiary)]">Not Eligible</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {project.eligible_for_editorial && (
                            <Button
                              variant="ridge"
                              size="sm"
                              onClick={() => handleSubmitForReview(project, 'editorial')}
                              className="flex items-center"
                            >
                              <FaRegNewspaper className="mr-2" /> Submit for Editorial
                            </Button>
                          )}
                          {project.eligible_for_print && (
                            <Button
                              variant="ridge"
                              size="sm"
                              onClick={() => handleSubmitForReview(project, 'print')}
                              className="flex items-center"
                            >
                              <FaPrint className="mr-2" /> Submit for Print
                            </Button>
                          )}
                          {!project.eligible_for_editorial && !project.eligible_for_print && (
                            <span className="text-[var(--text-tertiary)] text-sm">No actions available</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RidgeCard>
        )}

        {/* Boost Product Modal */}
        {showBoostModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <RidgeCard padding="lg" className="w-full max-w-md relative">
              <button
                onClick={() => setShowBoostModal(false)}
                className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <FaTimes className="text-2xl" />
              </button>
              <h2 className="folio-h2 text-[var(--accent)] mb-6 text-center">Boost {boostedItem?.type === 'product' ? 'Product' : 'Project'}</h2>
              {!showConfirmation ? (
                <>
                  <p className="folio-body text-[var(--text-secondary)] mb-6 text-center">
                    Are you sure you want to request a boost for <span className="font-semibold text-[var(--text-primary)]">{boostedItem?.name}</span>?
                  </p>
                  {boostedItem?.type === 'project' && (
                    <div className="mb-6">
                      <label htmlFor="vendorSelect" className="block folio-meta mb-2">Propose collaboration with tagged vendors (optional):</label>
                      <select
                        id="vendorSelect"
                        multiple
                        className="w-full p-2 rounded-lg ridge-input"
                      >
                        {/* Simulate vendors from the current project's tagged products */}
                        {projectsData.find(p => p.project_name === boostedItem.name)?.products_tagged.map((product, index) => (
                          <option key={index}>{product.product_name} Vendor</option>
                        ))}
                      </select>
                      <p className="folio-meta mt-1">Hold Ctrl/Cmd to select multiple vendors.</p>
                    </div>
                  )}
                  <p className="folio-meta mb-8 text-center">
                    This will send a collaboration request.
                  </p>
                  <div className="flex justify-center space-x-4">
                    <Button variant="accent" onClick={confirmBoost}>
                      Confirm Boost
                    </Button>
                    <Button variant="ridge" onClick={() => setShowBoostModal(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <FaRocket className="text-6xl text-green-500 mx-auto mb-4 animate-bounce" />
                  <p className="folio-h3 text-[var(--text-primary)]">Boost request sent for {boostedItem?.name}!</p>
                  <p className="folio-body text-[var(--text-secondary)] mt-2">The vendor will be notified.</p>
                </div>
              )}
            </RidgeCard>
          </div>
        )}
      </div>
    </div>
  );
}