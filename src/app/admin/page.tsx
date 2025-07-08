'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaUser, FaStore, FaPalette, FaProjectDiagram, FaToggleOn, FaToggleOff, FaBoxes, FaDownload, FaNewspaper, FaCalendarAlt } from 'react-icons/fa';
import { useRole } from '../../contexts/RoleContext';
import Navigation from '../../components/Navigation';
import Link from 'next/link';

interface DesignerProfile {
  id: string;
  name: string;
  bio?: string;
  profileImage?: string;
  projectCount: number;
  isActive: boolean;
}

interface VendorProfile {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  productCount: number;
  isActive: boolean;
}

export default function AdminDashboard() {
  const { role, activeProfileId, setActiveProfileId } = useRole();
  const [designers, setDesigners] = useState<DesignerProfile[]>([]);
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'designers' | 'vendors' | 'projects' | 'products' | 'editorial' | 'events'>('overview');

  // Redirect if not admin
  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-folio-background flex">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-folio-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FaUser className="w-8 h-8 text-folio-accent" />
            </div>
            <h2 className="text-2xl font-bold text-folio-text mb-2">Admin Only</h2>
            <p className="text-folio-border">
              Switch to "Admin" role using the dropdown in the top-right to access admin features.
            </p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    // Load existing designers and vendors
    loadDesigners();
    loadVendors();
  }, []);

  const loadDesigners = async () => {
    try {
      const response = await fetch('/api/designers');
      const data = await response.json();
      const designerProfiles = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        bio: d.bio,
        profileImage: d.profileImage,
        projectCount: d.folders?.length || 0,
        isActive: d.id === activeProfileId
      }));
      setDesigners(designerProfiles);
    } catch (error) {
      console.error('Error loading designers:', error);
    }
  };

  const loadVendors = async () => {
    try {
      const response = await fetch('/vendors.json');
      const data = await response.json();
      const vendorProfiles = data.map((v: any) => ({
        id: v.id,
        name: v.name,
        description: v.description,
        logo: v.logo,
        productCount: v.products?.length || 0,
        isActive: v.id === activeProfileId
      }));
      setVendors(vendorProfiles);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const toggleDesignerProfile = (designerId: string) => {
    const newActiveId = activeProfileId === designerId ? '' : designerId;
    setActiveProfileId(newActiveId);
    setDesigners(prev => prev.map(d => ({
      ...d,
      isActive: d.id === newActiveId
    })));
  };

  const toggleVendorProfile = (vendorId: string) => {
    const newActiveId = activeProfileId === vendorId ? '' : vendorId;
    setActiveProfileId(newActiveId);
    setVendors(prev => prev.map(v => ({
      ...v,
      isActive: v.id === newActiveId
    })));
  };

  const stats = {
    totalDesigners: designers.length,
    totalVendors: vendors.length,
    totalProjects: designers.reduce((sum, d) => sum + d.projectCount, 0),
    totalProducts: vendors.reduce((sum, v) => sum + v.productCount, 0)
  };

  return (
    <div className="min-h-screen bg-folio-background flex">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-folio-text mb-2">Admin Dashboard</h1>
            <p className="text-folio-border">Manage designers, vendors, and content creation</p>
            {activeProfileId && (
              <div className="mt-2 px-3 py-1 bg-folio-accent text-white rounded-lg text-sm inline-block">
                Active Profile: {designers.find(d => d.id === activeProfileId)?.name || vendors.find(v => v.id === activeProfileId)?.name}
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="border-b border-folio-border">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: 'overview', label: 'Overview', icon: FaProjectDiagram },
                  { id: 'designers', label: 'Designers', icon: FaPalette },
                  { id: 'vendors', label: 'Vendors', icon: FaStore },
                  { id: 'projects', label: 'Create Project', icon: FaPlus },
                  { id: 'products', label: 'Products', icon: FaBoxes },
                  { id: 'editorial', label: 'Editorial', icon: FaNewspaper },
                  { id: 'events', label: 'Events', icon: FaCalendarAlt }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-folio-accent text-folio-accent'
                          : 'border-transparent text-folio-border hover:text-folio-text hover:border-folio-border'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-folio-border">
                <div className="flex items-center">
                  <div className="p-2 bg-folio-muted rounded-lg">
                    <FaPalette className="w-6 h-6 text-folio-accent" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-folio-border">Designers</p>
                    <p className="text-2xl font-bold text-folio-text">{stats.totalDesigners}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-folio-border">
                <div className="flex items-center">
                  <div className="p-2 bg-folio-muted rounded-lg">
                    <FaStore className="w-6 h-6 text-folio-accent" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-folio-border">Vendors</p>
                    <p className="text-2xl font-bold text-folio-text">{stats.totalVendors}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-folio-border">
                <div className="flex items-center">
                  <div className="p-2 bg-folio-muted rounded-lg">
                    <FaProjectDiagram className="w-6 h-6 text-folio-accent" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-folio-border">Projects</p>
                    <p className="text-2xl font-bold text-folio-text">{stats.totalProjects}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-folio-border">
                <div className="flex items-center">
                  <div className="p-2 bg-folio-muted rounded-lg">
                    <FaPlus className="w-6 h-6 text-folio-accent" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-folio-border">Products</p>
                    <p className="text-2xl font-bold text-folio-text">{stats.totalProducts}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Link
                href="/admin/create-project"
                className="bg-white rounded-xl p-6 shadow-sm border border-folio-border hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-folio-accent rounded-lg group-hover:bg-folio-accent-hover transition-colors">
                    <FaPlus className="w-6 h-6 text-folio-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-folio-text">Create Project</h3>
                    <p className="text-sm text-folio-border">Start new content creation workflow</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/admin/products"
                className="bg-white rounded-xl p-6 shadow-sm border border-folio-border hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-folio-accent rounded-lg group-hover:bg-folio-accent-hover transition-colors">
                    <FaStore className="w-6 h-6 text-folio-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-folio-text">Manage Products</h3>
                    <p className="text-sm text-folio-border">Review pending tags and vendor data</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/admin/export"
                className="bg-white rounded-xl p-6 shadow-sm border border-folio-border hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-folio-accent rounded-lg group-hover:bg-folio-accent-hover transition-colors">
                    <FaDownload className="w-6 h-6 text-folio-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-folio-text">Export Data</h3>
                    <p className="text-sm text-folio-border">Comprehensive product & project exports</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/admin/tasks"
                className="bg-white rounded-xl p-6 shadow-sm border border-folio-border hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-folio-accent rounded-lg group-hover:bg-folio-accent-hover transition-colors">
                    <FaProjectDiagram className="w-6 h-6 text-folio-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-folio-text">All Admin Tasks</h3>
                    <p className="text-sm text-folio-border">Access all admin functions</p>
                  </div>
                </div>
              </Link>
            </div>
            </>
          )}

          {activeTab === 'designers' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-folio-text">Designer Profiles</h2>
                <Link
                  href="/admin/create-designer"
                  className="bg-folio-accent text-white px-4 py-2 rounded-lg hover:bg-folio-accent-hover transition-colors flex items-center gap-2"
                >
                  <FaPlus className="w-4 h-4" />
                  Add Designer
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {designers.map((designer) => (
                  <motion.div
                    key={designer.id}
                    className={`bg-white rounded-xl p-6 shadow-sm border-2 transition-all duration-200 ${
                      designer.isActive ? 'border-folio-accent bg-folio-accent-hover' : 'border-folio-border hover:border-folio-accent'
                    }`}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-folio-muted rounded-full flex items-center justify-center">
                          <FaPalette className="w-6 h-6 text-folio-accent" />
                        </div>
                        <div>
                          <h3 className="font-bold text-folio-text">{designer.name}</h3>
                          <p className="text-sm text-folio-border">{designer.projectCount} projects</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleDesignerProfile(designer.id)}
                        className="flex items-center gap-2 text-sm"
                      >
                        {designer.isActive ? (
                          <FaToggleOn className="w-5 h-5 text-folio-accent" />
                        ) : (
                          <FaToggleOff className="w-5 h-5 text-folio-border" />
                        )}
                      </button>
                    </div>
                    {designer.bio && (
                      <p className="text-sm text-folio-border mb-4">{designer.bio}</p>
                    )}
                    <div className="flex gap-2">
                      <Link
                        href={`/designer/${designer.id}`}
                        className="flex-1 text-center py-2 px-3 bg-folio-muted text-folio-accent rounded-lg hover:bg-folio-accent-hover transition-colors text-sm"
                      >
                        View Profile
                      </Link>
                      <button className="flex-1 text-center py-2 px-3 bg-folio-border text-folio-text rounded-lg hover:bg-folio-accent transition-colors text-sm">
                        Edit
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'vendors' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-folio-text">Vendor Profiles</h2>
                <Link
                  href="/admin/create-vendor"
                  className="bg-folio-accent text-white px-4 py-2 rounded-lg hover:bg-folio-accent-hover transition-colors flex items-center gap-2"
                >
                  <FaPlus className="w-4 h-4" />
                  Add Vendor
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vendors.map((vendor) => (
                  <motion.div
                    key={vendor.id}
                    className={`bg-white rounded-xl p-6 shadow-sm border-2 transition-all duration-200 ${
                      vendor.isActive ? 'border-folio-accent bg-folio-accent-hover' : 'border-folio-border hover:border-folio-accent'
                    }`}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-folio-muted rounded-full flex items-center justify-center">
                          <FaStore className="w-6 h-6 text-folio-accent" />
                        </div>
                        <div>
                          <h3 className="font-bold text-folio-text">{vendor.name}</h3>
                          <p className="text-sm text-folio-border">{vendor.productCount} products</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleVendorProfile(vendor.id)}
                        className="flex items-center gap-2 text-sm"
                      >
                        {vendor.isActive ? (
                          <FaToggleOn className="w-5 h-5 text-folio-accent" />
                        ) : (
                          <FaToggleOff className="w-5 h-5 text-folio-border" />
                        )}
                      </button>
                    </div>
                    {vendor.description && (
                      <p className="text-sm text-folio-border mb-4">{vendor.description}</p>
                    )}
                    <div className="flex gap-2">
                      <Link
                        href={`/vendor/${vendor.id}`}
                        className="flex-1 text-center py-2 px-3 bg-folio-muted text-folio-accent rounded-lg hover:bg-folio-accent-hover transition-colors text-sm"
                      >
                        View Profile
                      </Link>
                      <button className="flex-1 text-center py-2 px-3 bg-folio-border text-folio-text rounded-lg hover:bg-folio-accent transition-colors text-sm">
                        Edit
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl p-8 shadow-sm border border-folio-border">
                <h2 className="text-2xl font-bold text-folio-text mb-6">Create New Project</h2>
                <p className="text-folio-border mb-8">
                  Start the content creation workflow by selecting a designer profile and uploading project images.
                </p>
                <Link
                  href="/admin/create-project"
                  className="w-full bg-folio-accent text-white py-3 px-6 rounded-lg hover:bg-folio-accent-hover transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <FaPlus className="w-5 h-5" />
                  Start Project Creation
                </Link>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl p-8 shadow-sm border border-folio-border">
                <h2 className="text-2xl font-bold text-folio-text mb-6">Product Management</h2>
                <p className="text-folio-border mb-8">
                  Manage all tagged products, review pending items, and generate vendor reports for business development.
                </p>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-folio-accent-hover rounded-lg p-4 border border-folio-accent">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-folio-muted rounded-lg flex items-center justify-center">
                        <FaBoxes className="w-5 h-5 text-folio-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-folio-accent font-medium">Pending Products</p>
                        <p className="text-2xl font-bold text-folio-accent">12</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-folio-accent-hover rounded-lg p-4 border border-folio-accent">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-folio-muted rounded-lg flex items-center justify-center">
                        <FaStore className="w-5 h-5 text-folio-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-folio-accent font-medium">Total Vendors</p>
                        <p className="text-2xl font-bold text-folio-accent">24</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-folio-accent-hover rounded-lg p-4 border border-folio-accent">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-folio-muted rounded-lg flex items-center justify-center">
                        <FaPalette className="w-5 h-5 text-folio-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-folio-accent font-medium">Total Tags</p>
                        <p className="text-2xl font-bold text-folio-accent">156</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Link
                  href="/admin/products"
                  className="w-full bg-folio-accent text-white py-3 px-6 rounded-lg hover:bg-folio-accent-hover transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <FaBoxes className="w-5 h-5" />
                  Open Product Management Dashboard
                </Link>
              </div>
            </div>
          )}

          {activeTab === 'editorial' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl p-8 shadow-sm border border-folio-border">
                <h2 className="text-2xl font-bold text-folio-text mb-6">Editorial Management</h2>
                <p className="text-folio-border mb-8">
                  Review project submissions from designers and approve them for editorial publication.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <FaNewspaper className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-yellow-600 font-medium">Pending Review</p>
                        <p className="text-2xl font-bold text-yellow-600">3</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <FaNewspaper className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-green-600 font-medium">Published</p>
                        <p className="text-2xl font-bold text-green-600">12</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FaNewspaper className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-blue-600 font-medium">Total Views</p>
                        <p className="text-2xl font-bold text-blue-600">8.2k</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Link
                  href="/admin/editorial-review"
                  className="w-full bg-folio-accent text-white py-3 px-6 rounded-lg hover:bg-folio-accent-hover transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <FaNewspaper className="w-5 h-5" />
                  Review Editorial Submissions
                </Link>
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl p-8 shadow-sm border border-folio-border">
                <h2 className="text-2xl font-bold text-folio-text mb-6">Event Management</h2>
                <p className="text-folio-border mb-8">
                  Create and manage events like design festivals, vendor showcases, and community meetups.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <FaCalendarAlt className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-purple-600 font-medium">Upcoming Events</p>
                        <p className="text-2xl font-bold text-purple-600">5</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <FaCalendarAlt className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-green-600 font-medium">Total Attendees</p>
                        <p className="text-2xl font-bold text-green-600">142</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FaCalendarAlt className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-blue-600 font-medium">Events Created</p>
                        <p className="text-2xl font-bold text-blue-600">12</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Link
                    href="/admin/create-event"
                    className="bg-folio-accent text-white py-4 px-6 rounded-lg hover:bg-folio-accent-hover transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <FaPlus className="w-5 h-5" />
                    Create New Event
                  </Link>
                  
                  <Link
                    href="/admin/events/approve"
                    className="bg-folio-border text-folio-text py-4 px-6 rounded-lg hover:bg-folio-accent hover:text-white transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <FaCalendarAlt className="w-5 h-5" />
                    Review Event Approvals
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 