'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaBriefcase, FaFilter, FaSort } from 'react-icons/fa';
import { useRole } from '../../contexts/RoleContext';
import Navigation from '../../components/Navigation';
import LeadPreferencesCard, { LeadPreferences } from '../../components/LeadPreferencesCard';
import ProjectMatchingEngine from '../../components/ProjectMatchingEngine';

export default function JobsPage() {
  const { role } = useRole();
  const [leadPreferences, setLeadPreferences] = useState<LeadPreferences | null>(null);

  // Redirect if not designer
  if (role !== 'designer') {
    return (
      <div className="min-h-screen bg-primary flex">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaBriefcase className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Designer Only Feature</h2>
            <p className="text-gray-600">
              Switch to "Designer" role using the dropdown in the top-right to access job matching.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <FaBriefcase className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Job Matching</h1>
            </div>
            <p className="text-gray-600">
              Find homeowner projects that match your expertise and preferences
            </p>
          </motion.div>

          <div className="space-y-8">
            {/* Lead Preferences Section */}
            <LeadPreferencesCard 
              preferences={leadPreferences}
              onSave={setLeadPreferences}
            />

            {/* Project Matching Section */}
            <ProjectMatchingEngine 
              preferences={leadPreferences}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 