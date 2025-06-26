'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { FaUser, FaStore, FaHome, FaToggleOn, FaToggleOff, FaCrown, FaEye, FaHeart, FaShare, FaPlus } from 'react-icons/fa';
import Navigation from '../../components/Navigation';
import ProfileSwitcher from '../../components/ProfileSwitcher';
import { useRole } from '../../contexts/RoleContext';

export default function ProfileSwitcherDemo() {
  const { role, activeProfileId, setActiveProfileId } = useRole();
  const [demoData, setDemoData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDemoData();
  }, [role, activeProfileId]);

  const loadDemoData = async () => {
    setLoading(true);
    try {
      // Simulate loading profile-specific data
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (role === 'designer') {
        const designerData = await loadDesignerData(activeProfileId);
        setDemoData(designerData);
      } else if (role === 'vendor') {
        const vendorData = await loadVendorData(activeProfileId);
        setDemoData(vendorData);
      } else if (role === 'homeowner') {
        const homeownerData = await loadHomeownerData(activeProfileId);
        setDemoData(homeownerData);
      }
    } catch (error) {
      console.error('Error loading demo data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDesignerData = async (profileId: string | undefined) => {
    // Mock designer data based on profile
    const designers = {
      'designer-1': {
        name: 'Sarah Chen',
        specialty: 'Modern Minimalist',
        projects: [
          { id: 1, name: 'Waterfront Retreat', views: 2.1, saves: 456 },
          { id: 2, name: 'Urban Loft', views: 1.8, saves: 342 },
          { id: 3, name: 'Coastal Villa', views: 3.2, saves: 678 }
        ],
        followers: 12500,
        totalViews: 45600
      },
      'designer-2': {
        name: 'Marcus Johnson',
        specialty: 'Industrial Chic',
        projects: [
          { id: 1, name: 'Brooklyn Warehouse', views: 1.9, saves: 234 },
          { id: 2, name: 'Factory Conversion', views: 2.3, saves: 445 }
        ],
        followers: 8900,
        totalViews: 32100
      },
      'designer-3': {
        name: 'Elena Rodriguez',
        specialty: 'Bohemian Luxury',
        projects: [
          { id: 1, name: 'Desert Oasis', views: 2.7, saves: 567 },
          { id: 2, name: 'Moroccan Inspired', views: 1.5, saves: 289 },
          { id: 3, name: 'Eclectic Penthouse', views: 2.9, saves: 623 }
        ],
        followers: 15200,
        totalViews: 52800
      }
    };
    
    return designers[profileId as keyof typeof designers] || designers['designer-1'];
  };

  const loadVendorData = async (profileId: string | undefined) => {
    // Mock vendor data based on profile
    const vendors = {
      'vendor-1': {
        name: 'Modern Living Co.',
        category: 'Contemporary Furniture',
        products: [
          { id: 1, name: 'Sleek Dining Table', price: 1299, orders: 45 },
          { id: 2, name: 'Minimalist Sofa', price: 2199, orders: 23 },
          { id: 3, name: 'Glass Coffee Table', price: 899, orders: 67 }
        ],
        totalSales: 156000,
        monthlyOrders: 134
      },
      'vendor-2': {
        name: 'Artisan Crafts',
        category: 'Handmade Decor',
        products: [
          { id: 1, name: 'Ceramic Vase Set', price: 149, orders: 89 },
          { id: 2, name: 'Woven Wall Hanging', price: 79, orders: 156 }
        ],
        totalSales: 45600,
        monthlyOrders: 78
      },
      'vendor-3': {
        name: 'Luxury Lighting',
        category: 'Designer Lighting',
        products: [
          { id: 1, name: 'Crystal Chandelier', price: 3499, orders: 12 },
          { id: 2, name: 'Modern Pendant Light', price: 599, orders: 34 },
          { id: 3, name: 'Brass Table Lamp', price: 299, orders: 78 }
        ],
        totalSales: 89200,
        monthlyOrders: 45
      }
    };
    
    return vendors[profileId as keyof typeof vendors] || vendors['vendor-1'];
  };

  const loadHomeownerData = async (profileId: string | undefined) => {
    // Mock homeowner data based on profile
    const homeowners = {
      'homeowner-1': {
        name: 'Sarah Thompson',
        location: 'Brooklyn, NY',
        budget: '$50k–$100k',
        projectType: 'Kitchen & Dining Room',
        savedItems: 47,
        projectStatus: 'Ready to start',
        serviceLevel: 'Full service'
      },
      'homeowner-2': {
        name: 'Michael Chen',
        location: 'Austin, TX',
        budget: '$20k–$50k',
        projectType: 'Living Room Refresh',
        savedItems: 23,
        projectStatus: 'Gathering ideas',
        serviceLevel: 'Designer guidance'
      },
      'homeowner-3': {
        name: 'Jessica Martinez',
        location: 'Seattle, WA',
        budget: '$100k+',
        projectType: 'Whole House Renovation',
        savedItems: 89,
        projectStatus: 'In progress',
        serviceLevel: 'Full service'
      }
    };
    
    return homeowners[profileId as keyof typeof homeowners] || homeowners['homeowner-1'];
  };

  const renderDesignerContent = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border border-folio-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-folio-text">{demoData.name}</h2>
            <p className="text-folio-border">{demoData.specialty}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-folio-accent">{demoData.followers?.toLocaleString()}</div>
            <div className="text-sm text-folio-border">Followers</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {demoData.projects?.map((project: any) => (
            <div key={project.id} className="bg-folio-background rounded-lg p-4">
              <h3 className="font-medium text-folio-text mb-2">{project.name}</h3>
              <div className="flex justify-between text-sm">
                <span className="text-folio-border">{project.views}k views</span>
                <span className="text-folio-accent">{project.saves} saves</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderVendorContent = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border border-folio-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-folio-text">{demoData.name}</h2>
            <p className="text-folio-border">{demoData.category}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-folio-accent">${demoData.totalSales?.toLocaleString()}</div>
            <div className="text-sm text-folio-border">Total Sales</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {demoData.products?.map((product: any) => (
            <div key={product.id} className="bg-folio-background rounded-lg p-4">
              <h3 className="font-medium text-folio-text mb-2">{product.name}</h3>
              <div className="flex justify-between text-sm">
                <span className="text-folio-accent">${product.price}</span>
                <span className="text-folio-border">{product.orders} orders</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderHomeownerContent = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border border-folio-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-folio-text">{demoData.name}</h2>
            <p className="text-folio-border">{demoData.location}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-folio-accent">{demoData.savedItems}</div>
            <div className="text-sm text-folio-border">Saved Items</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-folio-border">Budget Range:</span>
              <span className="text-folio-text font-medium">{demoData.budget}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-folio-border">Project Type:</span>
              <span className="text-folio-text font-medium">{demoData.projectType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-folio-border">Status:</span>
              <span className="text-folio-accent font-medium">{demoData.projectStatus}</span>
            </div>
          </div>
          <div className="bg-folio-background rounded-lg p-4">
            <h3 className="font-medium text-folio-text mb-2">Service Level</h3>
            <p className="text-folio-border text-sm">{demoData.serviceLevel}</p>
            <div className="mt-3">
              <button className="w-full bg-folio-accent text-white py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors">
                Find Matching Designers
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-folio-accent"></div>
        </div>
      );
    }

    switch (role) {
      case 'designer':
        return renderDesignerContent();
      case 'vendor':
        return renderVendorContent();
      case 'homeowner':
        return renderHomeownerContent();
      default:
        return (
          <div className="text-center py-12">
            <p className="text-folio-border">Select a role to see profile-specific content</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-folio-background">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-bold text-folio-text mb-2">Profile Switcher Demo</h1>
            <p className="text-folio-border">
              Experience how different user roles can switch between multiple profiles to manage content and showcase work.
            </p>
          </motion.div>

          {/* Profile Switcher */}
          {['designer', 'vendor', 'homeowner'].includes(role) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ProfileSwitcher onProfileChange={(profileId) => {
                console.log('Profile changed to:', profileId);
              }} />
            </motion.div>
          )}

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {renderContent()}
          </motion.div>

          {/* Instructions */}
          <motion.div 
            className="mt-8 bg-folio-card rounded-xl p-6 border border-folio-border"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-semibold text-folio-text mb-3">How It Works</h3>
            <div className="space-y-2 text-folio-border">
              <p>• <strong>Designers:</strong> Switch between different designer profiles to view and manage their individual portfolios and projects.</p>
              <p>• <strong>Vendors:</strong> Toggle between vendor profiles to manage products, view sales data, and track performance.</p>
              <p>• <strong>Homeowners:</strong> Switch between different homeowner profiles to see their project requirements and saved items for matchmaking.</p>
              <p>• <strong>Admin:</strong> Can switch between any profile type to manage content and oversee the platform.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
} 