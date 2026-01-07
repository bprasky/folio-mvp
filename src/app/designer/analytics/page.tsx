'use client';

import { useState } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import designerAnalyticsData from '@/data/designer_analytics.json';
import designerProjectsData from '@/data/designer_projects.json';
import { FaEye, FaUsers, FaFolder, FaTag, FaDollarSign, FaRocket, FaTimes, FaComment, FaNewspaper, FaPrint, FaRegNewspaper } from 'react-icons/fa';

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
    <div className="min-h-screen bg-zinc-950 text-gray-100 p-8 lg:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Designer Overview Header */}
        <div className="bg-zinc-900 rounded-lg shadow-xl p-6 mb-10 flex flex-col md:flex-row items-center md:justify-between">
          <div className="flex items-center mb-6 md:mb-0">
            <SafeImage
              src={productData.profile_image}
              alt={productData.designer_name}
              width={96}
              height={96}
              className="rounded-full border-4 border-amber-400 object-cover mr-6"
            />
            <div>
              <h1 className="text-4xl font-bold text-amber-400 mb-1">{productData.designer_name}</h1>
              <p className="text-gray-400 text-lg">Your Analytics Dashboard</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 text-center w-full md:w-auto">
            <div className="p-4 bg-zinc-800 rounded-lg">
              <FaEye className="text-3xl text-blue-400 mx-auto mb-2" />
              <p className="text-xl font-bold">{productData.profile_views_total}</p>
              <p className="text-gray-400 text-sm">Profile Views</p>
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg">
              <FaUsers className="text-3xl text-purple-400 mx-auto mb-2" />
              <p className="text-xl font-bold">{productData.followers_total}</p>
              <p className="text-gray-400 text-sm">Followers</p>
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg">
              <FaFolder className="text-3xl text-green-400 mx-auto mb-2" />
              <p className="text-xl font-bold">{productData.projects_saved_total}</p>
              <p className="text-gray-400 text-sm">Projects Saved</p>
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg">
              <FaTag className="text-3xl text-red-400 mx-auto mb-2" />
              <p className="text-xl font-bold">{productData.products_tagged_total}</p>
              <p className="text-gray-400 text-sm">Products Tagged</p>
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg col-span-2 lg:col-span-1">
              <FaDollarSign className="text-3xl text-yellow-400 mx-auto mb-2" />
              <p className="text-xl font-bold">{productData.earnings_pending}</p>
              <p className="text-gray-400 text-sm">Pending Earnings</p>
            </div>
          </div>
        </div>

        {/* Analytics Tabs */}
        <div className="flex space-x-4 mb-8 border-b border-zinc-700">
          <button
            className={`px-4 py-3 text-lg font-semibold ${
              activeTab === 'product'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('product')}
          >
            Product Engagement
          </button>
          <button
            className={`px-4 py-3 text-lg font-semibold ${
              activeTab === 'project'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('project')}
          >
            Project Performance
          </button>
          <button
            className={`px-4 py-3 text-lg font-semibold ${
              activeTab === 'opportunities'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('opportunities')}
          >
            Opportunities
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'product' && (
          <div className="bg-zinc-900 rounded-lg shadow-xl p-6 mb-10">
            <h2 className="text-3xl font-bold text-amber-400 mb-6">Product Engagement Leaderboard</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left table-auto">
                <thead>
                  <tr className="bg-zinc-800">
                    <th className="px-4 py-3 rounded-tl-lg">Product</th>
                    <th className="px-4 py-3">Views</th>
                    <th className="px-4 py-3">Saves</th>
                    <th className="px-4 py-3">Clicks</th>
                    <th className="px-4 py-3">Events</th>
                    <th className="px-4 py-3 rounded-tr-lg">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {productData.top_tagged_products.map((product, index) => (
                    <tr key={index} className="border-t border-zinc-700 hover:bg-zinc-850">
                      <td className="px-4 py-4 flex items-center">
                        <SafeImage
                          src={product.product_image}
                          alt={product.product_name}
                          width={48}
                          height={48}
                          className="rounded-md object-cover mr-3"
                        />
                        <Link
                          href={product.product_name === 'Eco Modular Sofa' ? '/product/eco-modular-sofa' : `#/product/${product.product_name.toLowerCase().replace(/\s/g, '-')}`}
                          className="font-medium text-gray-200 hover:underline"
                        >
                          {product.product_name}
                        </Link>
                      </td>
                      <td className="px-4 py-4">{product.views_from_designer}</td>
                      <td className="px-4 py-4">{product.saves_from_designer}</td>
                      <td className="px-4 py-4">{product.outbound_clicks_from_designer}</td>
                      <td className="px-4 py-4">
                        {product.events_featured_in.length > 0 ? (
                          <ul className="list-disc list-inside text-gray-400">
                            {product.events_featured_in.map((event, i) => (
                              <li key={i}>{event}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleBoostClick('product', product.product_name)}
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center justify-center"
                        >
                          <FaRocket className="mr-2" /> Boost Product
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'project' && (
          <div className="bg-zinc-900 rounded-lg shadow-xl p-6 mb-10">
            <h2 className="text-3xl font-bold text-amber-400 mb-6">Project Performance Leaderboard</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left table-auto">
                <thead>
                  <tr className="bg-zinc-800">
                    <th className="px-4 py-3 rounded-tl-lg">Project</th>
                    <th className="px-4 py-3">Views</th>
                    <th className="px-4 py-3">Saves</th>
                    <th className="px-4 py-3">Top Comment</th>
                    <th className="px-4 py-3">Products Tagged</th>
                    <th className="px-4 py-3 rounded-tr-lg">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsData.map((project, index) => (
                    <>
                      <tr key={index} className="border-t border-zinc-700 hover:bg-zinc-850">
                        <td className="px-4 py-4 flex items-center">
                          <button
                            onClick={() => toggleProjectDetails(project.project_name)}
                            className="mr-2 text-gray-400 hover:text-gray-200"
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
                          <span className="font-medium text-gray-200">{project.project_name}</span>
                        </td>
                        <td className="px-4 py-4">{project.total_views}</td>
                        <td className="px-4 py-4">{project.project_saves}</td>
                        <td className="px-4 py-4">
                          {project.comments.length > 0 ? (
                            <span className="text-gray-400 text-sm italic">"{project.comments[0].comment_text}"</span>
                          ) : (
                            <span className="text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {project.products_tagged.length > 0 ? (
                            <span className="text-gray-400 text-sm">
                              {project.products_tagged.length} products
                            </span>
                          ) : (
                            <span className="text-gray-500">None</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => handleBoostClick('project', project.project_name)}
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center justify-center"
                          >
                            <FaRocket className="mr-2" /> Boost Project
                          </button>
                        </td>
                      </tr>
                      {expandedProjects[project.project_name] && (
                        <tr className="bg-zinc-850">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <h3 className="text-lg font-semibold text-amber-400 mb-3">Tagged Products</h3>
                                <div className="space-y-3">
                                  {project.products_tagged.map((product, i) => (
                                    <div key={i} className="flex items-center bg-zinc-800 p-3 rounded-lg">
                                      <SafeImage
                                        src={product.product_image}
                                        alt={product.product_name}
                                        width={40}
                                        height={40}
                                        className="rounded-md object-cover mr-3"
                                      />
                                      <div>
                                        <p className="font-medium text-gray-200">{product.product_name}</p>
                                        <p className="text-sm text-gray-400">
                                          Views: {product.views_from_project} • Saves: {product.saves_from_project} • Clicks: {product.outbound_clicks_from_project}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-amber-400 mb-3">Project Engagement</h3>
                                <div className="bg-zinc-800 p-4 rounded-lg">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-gray-400 text-sm">Total Views</p>
                                      <p className="text-xl font-bold text-gray-200">{project.total_views}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 text-sm">Total Saves</p>
                                      <p className="text-xl font-bold text-gray-200">{project.project_saves}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 text-sm">Products Tagged</p>
                                      <p className="text-xl font-bold text-gray-200">{project.products_tagged.length}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 text-sm">Comments</p>
                                      <p className="text-xl font-bold text-gray-200">{project.comments.length}</p>
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
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div className="bg-zinc-900 rounded-lg shadow-xl p-6 mb-10">
            <h2 className="text-3xl font-bold text-amber-400 mb-6">Editorial & Print Opportunities</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left table-auto">
                <thead>
                  <tr className="bg-zinc-800">
                    <th className="px-4 py-3 rounded-tl-lg">Project</th>
                    <th className="px-4 py-3">Eligibility</th>
                    <th className="px-4 py-3 rounded-tr-lg">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsData.map((project, index) => (
                    <tr key={index} className="border-t border-zinc-700 hover:bg-zinc-850">
                      <td className="px-4 py-4 flex items-center">
                        <SafeImage
                          src={project.project_image}
                          alt={project.project_name}
                          width={48}
                          height={48}
                          className="rounded-md object-cover mr-3"
                        />
                        <span className="font-medium text-gray-200">{project.project_name}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col space-y-2">
                          {project.eligible_for_editorial && (
                            <span className="inline-flex items-center bg-purple-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                              <FaNewspaper className="mr-1" /> Editorial Eligible
                            </span>
                          )}
                          {project.eligible_for_print && (
                            <span className="inline-flex items-center bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                              <FaPrint className="mr-1" /> Print Eligible
                            </span>
                          )}
                          {!project.eligible_for_editorial && !project.eligible_for_print && (
                            <span className="text-gray-500">Not Eligible</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {project.eligible_for_editorial && (
                            <button
                              onClick={() => handleSubmitForReview(project, 'editorial')}
                              className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 flex items-center justify-center"
                            >
                              <FaRegNewspaper className="mr-2" /> Submit for Editorial
                            </button>
                          )}
                          {project.eligible_for_print && (
                            <button
                              onClick={() => handleSubmitForReview(project, 'print')}
                              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 flex items-center justify-center"
                            >
                              <FaPrint className="mr-2" /> Submit for Print
                            </button>
                          )}
                          {!project.eligible_for_editorial && !project.eligible_for_print && (
                            <span className="text-gray-500 text-sm">No actions available</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Boost Product Modal */}
        {showBoostModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-lg shadow-2xl p-8 w-full max-w-md relative border border-zinc-700">
              <button
                onClick={() => setShowBoostModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors duration-200"
              >
                <FaTimes className="text-2xl" />
              </button>
              <h2 className="text-3xl font-bold text-amber-400 mb-6 text-center">Boost {boostedItem?.type === 'product' ? 'Product' : 'Project'}</h2>
              {!showConfirmation ? (
                <>
                  <p className="text-gray-300 text-lg mb-6 text-center">
                    Are you sure you want to request a boost for <span className="font-semibold text-white">{boostedItem?.name}</span>?
                  </p>
                  {boostedItem?.type === 'project' && (
                    <div className="mb-6">
                      <label htmlFor="vendorSelect" className="block text-gray-400 text-sm font-medium mb-2">Propose collaboration with tagged vendors (optional):</label>
                      <select
                        id="vendorSelect"
                        multiple
                        className="w-full p-2 rounded-md bg-zinc-800 border border-zinc-700 text-white focus:ring-amber-400 focus:border-amber-400"
                      >
                        {/* Simulate vendors from the current project's tagged products */}
                        {projectsData.find(p => p.project_name === boostedItem.name)?.products_tagged.map((product, index) => (
                          <option key={index}>{product.product_name} Vendor</option> // Placeholder, ideally fetch actual vendor names
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple vendors.</p>
                    </div>
                  )}
                  <p className="text-gray-400 text-sm mb-8 text-center">
                    This will send a collaboration request.
                  </p>
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={confirmBoost}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-full font-semibold hover:from-green-600 hover:to-emerald-600 transition-all duration-200"
                    >
                      Confirm Boost
                    </button>
                    <button
                      onClick={() => setShowBoostModal(false)}
                      className="bg-gray-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-700 transition-colors duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <FaRocket className="text-6xl text-green-500 mx-auto mb-4 animate-bounce" />
                  <p className="text-white text-xl font-semibold">Boost request sent for {boostedItem?.name}!</p>
                  <p className="text-gray-400 mt-2">The vendor will be notified.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}