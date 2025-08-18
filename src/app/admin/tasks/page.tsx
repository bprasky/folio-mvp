'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  FaProjectDiagram, 
  FaBoxOpen, 
  FaUsers, 
  FaStore, 
  FaUserPlus,
  FaCrown,
  FaArrowLeft,
  FaPlus
} from 'react-icons/fa';

const taskCategories = [
  {
    title: 'Content Creation',
    description: 'Create and manage platform content',
    tasks: [
      {
        id: 'create-project',
        title: 'Create Project',
        description: 'Add new design projects with images and product tagging',
        icon: FaProjectDiagram,
        href: '/admin/create-project',
        color: 'bg-blue-500',
        hoverColor: 'hover:bg-blue-600'
      },
      {
        id: 'add-product',
        title: 'Add Product',
        description: 'Upload new products to the marketplace',
        icon: FaBoxOpen,
        href: '/vendor/create-product',
        color: 'bg-green-500',
        hoverColor: 'hover:bg-green-600'
      }
    ]
  },
  {
    title: 'User Management',
    description: 'Manage designers, vendors, and users',
    tasks: [
      {
        id: 'manage-designers',
        title: 'Manage Designers',
        description: 'View and manage designer profiles and portfolios',
        icon: FaUsers,
        href: '/admin?tab=designers',
        color: 'bg-purple-500',
        hoverColor: 'hover:bg-purple-600'
      },
      {
        id: 'manage-vendors',
        title: 'Manage Vendors',
        description: 'View and manage vendor profiles and products',
        icon: FaStore,
        href: '/admin?tab=vendors',
        color: 'bg-orange-500',
        hoverColor: 'hover:bg-orange-600'
      },
      {
        id: 'create-user',
        title: 'Create User',
        description: 'Add new users to the platform',
        icon: FaUserPlus,
        href: '/admin/create-user',
        color: 'bg-indigo-500',
        hoverColor: 'hover:bg-indigo-600'
      }
    ]
  }
];

export default function AdminTasks() {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8"
          >
            <Link
              href="/admin"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <FaArrowLeft />
              <span>Back to Admin Dashboard</span>
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                <FaCrown className="text-white text-2xl" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Tasks</h1>
            <p className="text-gray-600 text-lg">
              Choose from all available creation and management tasks
            </p>
          </motion.div>

          {/* Task Categories */}
          <div className="space-y-12">
            {taskCategories.map((category, categoryIndex) => (
              <motion.div
                key={category.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * categoryIndex }}
              >
                {/* Category Header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{category.title}</h2>
                  <p className="text-gray-600">{category.description}</p>
                </div>

                {/* Tasks Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.tasks.map((task, taskIndex) => {
                    const Icon = task.icon;
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * (categoryIndex + taskIndex) }}
                        whileHover={{ scale: 1.02 }}
                        className="group"
                      >
                        <Link
                          href={task.href}
                          className="block bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200"
                        >
                          {/* Icon */}
                          <div className={`w-14 h-14 ${task.color} ${task.hoverColor} rounded-xl flex items-center justify-center mb-4 transition-colors group-hover:scale-110 transform duration-300`}>
                            <Icon className="text-white text-xl" />
                          </div>

                          {/* Content */}
                          <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                            {task.title}
                          </h3>
                          <p className="text-gray-600 text-sm leading-relaxed mb-4">
                            {task.description}
                          </p>

                          {/* Action Indicator */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">
                              Click to start
                            </span>
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                              <FaPlus className="text-gray-600 text-sm" />
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Need Help?</h2>
              <p className="text-blue-100 mb-6">
                As an admin, you have access to all platform features. 
                Contact support if you need assistance with any task.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/admin"
                  className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                >
                  Back to Dashboard
                </Link>
                <Link
                  href="/support"
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors border border-blue-400"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
    </div>
  );
} 