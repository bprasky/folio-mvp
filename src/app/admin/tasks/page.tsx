'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  FaProjectDiagram,
  FaBoxOpen,
  FaUsers,
  FaStore,
  FaUserPlus,
  FaArrowLeft,
  FaPlus
} from 'react-icons/fa';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

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
      },
      {
        id: 'add-product',
        title: 'Add Product',
        description: 'Upload new products to the marketplace',
        icon: FaBoxOpen,
        href: '/vendor/create-product',
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
      },
      {
        id: 'manage-vendors',
        title: 'Manage Vendors',
        description: 'View and manage vendor profiles and products',
        icon: FaStore,
        href: '/admin?tab=vendors',
      },
      {
        id: 'create-user',
        title: 'Create User',
        description: 'Add new users to the platform',
        icon: FaUserPlus,
        href: '/admin/create-user',
      }
    ]
  }
];

export default function AdminTasks() {
  return (
    <div className="min-h-screen bg-surface-canvas py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            href="/admin"
            className="inline-flex items-center space-x-2 text-folio-text-secondary hover:text-folio-text-primary transition-colors"
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
            <div className="w-16 h-16 bg-[var(--accent)] rounded-full flex items-center justify-center">
              <span className="text-white text-2xl">*</span>
            </div>
          </div>
          <h1 className="folio-h1 mb-2">Admin Tasks</h1>
          <p className="folio-body">
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
                <h2 className="folio-h2 mb-2">{category.title}</h2>
                <p className="folio-body">{category.description}</p>
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
                      <Link href={task.href}>
                        <RidgeCard className="h-full hover:shadow-lg transition-all duration-300">
                          {/* Icon */}
                          <div className="w-14 h-14 bg-[var(--accent)] rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-300">
                            <Icon className="text-white text-xl" />
                          </div>

                          {/* Content */}
                          <h3 className="folio-h3 mb-2 group-hover:text-[var(--accent)] transition-colors">
                            {task.title}
                          </h3>
                          <p className="folio-body mb-4">
                            {task.description}
                          </p>

                          {/* Action Indicator */}
                          <div className="flex items-center justify-between">
                            <span className="folio-meta group-hover:text-folio-text-primary transition-colors">
                              Click to start
                            </span>
                            <div className="w-8 h-8 bg-surface-ground rounded-full flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-colors">
                              <FaPlus className="text-sm" />
                            </div>
                          </div>
                        </RidgeCard>
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
          className="mt-16"
        >
          <RidgeCard padding="xl" className="text-center">
            <h2 className="folio-h2 mb-2">Need Help?</h2>
            <p className="folio-body mb-6">
              As an admin, you have access to all platform features.
              Contact support if you need assistance with any task.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/admin">
                <Button variant="ridge">
                  Back to Dashboard
                </Button>
              </Link>
              <Link href="/support">
                <Button variant="accent">
                  Contact Support
                </Button>
              </Link>
            </div>
          </RidgeCard>
        </motion.div>
      </div>
    </div>
  );
}
