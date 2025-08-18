'use client';

import { motion } from 'framer-motion';
import { 
  FaSearch, 
  FaHeart, 
  FaFolder, 
  FaPalette, 
  FaCamera, 
  FaUsers, 
  FaBox, 
  FaChartLine, 
  FaBullhorn,
  FaChartBar,
  FaCog
} from 'react-icons/fa';
import { useRole, UserRole } from '../contexts/RoleContext';

interface FeatureButton {
  icon: React.ComponentType<any>;
  label: string;
  description: string;
  color: string;
  onClick?: () => void;
}

const roleFeatures: Record<UserRole, { title: string; subtitle: string; features: FeatureButton[] }> = {
  homeowner: {
    title: 'Welcome, Homeowner!',
    subtitle: 'Discover inspiration and connect with top designers',
    features: [
      {
        icon: FaSearch,
        label: 'Browse Projects',
        description: 'Explore stunning interior designs',
        color: 'bg-blue-500 hover:bg-blue-600',
        onClick: () => console.log('Browse Projects clicked')
      },
      {
        icon: FaHeart,
        label: 'Save Favorites',
        description: 'Create your inspiration collection',
        color: 'bg-pink-500 hover:bg-pink-600',
        onClick: () => console.log('Save Favorites clicked')
      },
      {
        icon: FaUsers,
        label: 'Find Designers',
        description: 'Connect with verified professionals',
        color: 'bg-purple-500 hover:bg-purple-600',
        onClick: () => console.log('Find Designers clicked')
      }
    ]
  },
  designer: {
    title: 'Designer Dashboard',
    subtitle: 'Showcase your work and grow your practice',
    features: [
      {
        icon: FaFolder,
        label: 'My Projects',
        description: 'Manage your portfolio',
        color: 'bg-purple-500 hover:bg-purple-600',
        onClick: () => console.log('My Projects clicked')
      },
      {
        icon: FaPalette,
        label: 'Create Moodboard',
        description: 'Build stunning presentations',
        color: 'bg-indigo-500 hover:bg-indigo-600',
        onClick: () => console.log('Create Moodboard clicked')
      },
      {
        icon: FaCamera,
        label: 'Photo Gallery',
        description: 'Upload and organize images',
        color: 'bg-teal-500 hover:bg-teal-600',
        onClick: () => console.log('Photo Gallery clicked')
      }
    ]
  },
  vendor: {
    title: 'Vendor Hub',
    subtitle: 'Showcase products and reach designers',
    features: [
      {
        icon: FaBox,
        label: 'Upload Product',
        description: 'Add items to your catalog',
        color: 'bg-green-500 hover:bg-green-600',
        onClick: () => console.log('Upload Product clicked')
      },
      {
        icon: FaChartLine,
        label: 'Analytics',
        description: 'Track performance metrics',
        color: 'bg-blue-500 hover:bg-blue-600',
        onClick: () => console.log('Analytics clicked')
      },
      {
        icon: FaBullhorn,
        label: 'Promote Products',
        description: 'Boost visibility and sales',
        color: 'bg-orange-500 hover:bg-orange-600',
        onClick: () => console.log('Promote Products clicked')
      }
    ]
  },
  student: {
    title: 'Student Hub',
    subtitle: 'Learn, grow, and build your design career',
    features: [
      {
        icon: FaSearch,
        label: 'Explore Feed',
        description: 'Discover student work and opportunities',
        color: 'bg-purple-500 hover:bg-purple-600',
        onClick: () => console.log('Explore Feed clicked')
      },
      {
        icon: FaFolder,
        label: 'My Portfolio',
        description: 'Showcase your design projects',
        color: 'bg-blue-500 hover:bg-blue-600',
        onClick: () => console.log('My Portfolio clicked')
      },
      {
        icon: FaUsers,
        label: 'Find Mentors',
        description: 'Connect with industry professionals',
        color: 'bg-teal-500 hover:bg-teal-600',
        onClick: () => console.log('Find Mentors clicked')
      }
    ]
  },
  admin: {
    title: 'Admin Dashboard',
    subtitle: 'Manage platform content and users',
    features: [
      {
        icon: FaUsers,
        label: 'User Management',
        description: 'Manage user accounts and roles',
        color: 'bg-red-500 hover:bg-red-600',
        onClick: () => console.log('User Management clicked')
      },
      {
        icon: FaChartBar,
        label: 'Analytics',
        description: 'View platform statistics',
        color: 'bg-blue-500 hover:bg-blue-600',
        onClick: () => console.log('Analytics clicked')
      },
      {
        icon: FaCog,
        label: 'Settings',
        description: 'Configure platform settings',
        color: 'bg-gray-500 hover:bg-gray-600',
        onClick: () => console.log('Settings clicked')
      }
    ]
  }
};

export default function RolePanel() {
  const { role, isLoading } = useRole();
  const currentRoleData = roleFeatures[role];

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center p-12"
      >
        <div className="flex items-center gap-3 text-gray-500">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
          />
          <span>Loading...</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={role}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl shadow-lg p-8 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-center mb-8"
      >
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {currentRoleData.title}
        </h2>
        <p className="text-gray-600 text-lg">
          {currentRoleData.subtitle}
        </p>
      </motion.div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {currentRoleData.features.map((feature, index) => {
          const Icon = feature.icon;
          
          return (
            <motion.button
              key={feature.label}
              onClick={feature.onClick}
              className="group p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 text-left bg-white hover:bg-gray-50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + (index * 0.1) }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}
                whileHover={{ rotate: 5 }}
              >
                <Icon className="w-6 h-6 text-white" />
              </motion.div>
              
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                {feature.label}
              </h3>
              
              <p className="text-sm text-gray-600 group-hover:text-gray-500 transition-colors">
                {feature.description}
              </p>
              
              {/* Hover indicator */}
              <motion.div
                className="mt-4 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                initial={{ scaleX: 0 }}
                whileHover={{ scaleX: 1 }}
                transition={{ duration: 0.3 }}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-8 pt-6 border-t border-gray-200 text-center"
      >
        <p className="text-sm text-gray-500">
          Your role is determined by your account type. Contact support to change your role.
        </p>
      </motion.div>
    </motion.div>
  );
} 