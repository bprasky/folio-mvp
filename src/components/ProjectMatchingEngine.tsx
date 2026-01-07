'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  FaFilter, 
  FaSort, 
  FaStar, 
  FaMapMarkerAlt, 
  FaDollarSign, 
  FaHome,
  FaEnvelope,
  FaSearch,
  FaBookmark
} from 'react-icons/fa';
import { LeadPreferences } from './LeadPreferencesCard';

interface HomeownerProject {
  id: string;
  homeownerName: string;
  projectName: string;
  projectType: string;
  budget: string;
  location: string;
  rooms: string[];
  styles: string[];
  description: string;
  savedPosts: number;
  timelineStatus: 'planning' | 'ready-to-start' | 'interviewing';
  createdAt: string;
  aiEnabled: boolean;
  matchScore?: number;
}

interface ProjectMatchingEngineProps {
  preferences: LeadPreferences | null;
}

// Mock data for homeowner projects
const MOCK_PROJECTS: HomeownerProject[] = [
  {
    id: '1',
    homeownerName: 'Sarah Johnson',
    projectName: 'Modern Kitchen Renovation',
    projectType: 'full-renovation',
    budget: '$50,000 - $100,000',
    location: 'Austin, TX 78701',
    rooms: ['Kitchen'],
    styles: ['Modern', 'Minimalist'],
    description: 'Looking to transform our outdated kitchen into a modern, functional space with clean lines and smart storage solutions.',
    savedPosts: 23,
    timelineStatus: 'ready-to-start',
    createdAt: '2024-01-15',
    aiEnabled: true
  },
  {
    id: '2',
    homeownerName: 'Michael Chen',
    projectName: 'Whole Home Design',
    projectType: 'new-build',
    budget: '$250,000 - $500,000',
    location: 'San Francisco, CA 94105',
    rooms: ['Living Room', 'Kitchen', 'Master Bedroom', 'Bathroom'],
    styles: ['Contemporary', 'Scandinavian'],
    description: 'New construction home needs complete interior design. Focus on sustainable materials and smart home integration.',
    savedPosts: 45,
    timelineStatus: 'interviewing',
    createdAt: '2024-01-10',
    aiEnabled: true
  },
  {
    id: '3',
    homeownerName: 'Emma Rodriguez',
    projectName: 'Living Room Refresh',
    projectType: 'decor-only',
    budget: '$10,000 - $25,000',
    location: 'Denver, CO 80202',
    rooms: ['Living Room'],
    styles: ['Bohemian', 'Eclectic'],
    description: 'Want to refresh our living room with new furniture, art, and accessories. Love bold colors and unique pieces.',
    savedPosts: 12,
    timelineStatus: 'planning',
    createdAt: '2024-01-20',
    aiEnabled: false
  },
  {
    id: '4',
    homeownerName: 'David Park',
    projectName: 'Master Suite Renovation',
    projectType: 'full-renovation',
    budget: '$100,000 - $250,000',
    location: 'Seattle, WA 98101',
    rooms: ['Master Bedroom', 'Bathroom'],
    styles: ['Transitional', 'Contemporary'],
    description: 'Complete master suite renovation including bedroom, walk-in closet, and luxury bathroom with spa features.',
    savedPosts: 34,
    timelineStatus: 'ready-to-start',
    createdAt: '2024-01-12',
    aiEnabled: true
  }
];

const BUDGET_ORDER = [
  '$10,000 - $25,000',
  '$25,000 - $50,000', 
  '$50,000 - $100,000',
  '$100,000 - $250,000',
  '$250,000 - $500,000',
  '$500,000+'
];

export default function ProjectMatchingEngine({ preferences }: ProjectMatchingEngineProps) {
  const [sortBy, setSortBy] = useState<'match' | 'recent' | 'budget'>('match');
  const [filterBudget, setFilterBudget] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('');
  // State for message functionality (future enhancement)

  // Calculate match scores
  const calculateMatchScore = (project: HomeownerProject): number => {
    if (!preferences) return 50;

    let score = 0;
    
    // Project type match
    if (preferences.projectTypes.includes(project.projectType)) {
      score += 30;
    }

    // Budget compatibility
    const projectBudgetIndex = BUDGET_ORDER.indexOf(project.budget);
    const idealBudgetIndex = BUDGET_ORDER.indexOf(preferences.idealBudgetRange);
    const minBudgetIndex = BUDGET_ORDER.indexOf(preferences.minimumBudget);
    
    if (projectBudgetIndex >= minBudgetIndex) {
      if (projectBudgetIndex === idealBudgetIndex) {
        score += 25;
      } else if (Math.abs(projectBudgetIndex - idealBudgetIndex) <= 1) {
        score += 20;
      } else {
        score += 10;
      }
    }

    // Timeline readiness
    if (project.timelineStatus === 'ready-to-start') {
      score += 20;
    } else if (project.timelineStatus === 'interviewing') {
      score += 15;
    } else {
      score += 5;
    }

    // Engagement style bonus (simplified)
    score += 10;

    return Math.min(100, score);
  };

  // Process and sort projects
  const processedProjects = useMemo(() => {
    let filtered = MOCK_PROJECTS.filter(project => {
      if (filterBudget !== 'all' && project.budget !== filterBudget) return false;
      if (filterLocation && !project.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
      return true;
    });

    // Add match scores
    const withScores = filtered.map(project => ({
      ...project,
      matchScore: calculateMatchScore(project)
    }));

    // Sort
    withScores.sort((a, b) => {
      switch (sortBy) {
        case 'match':
          return (b.matchScore || 0) - (a.matchScore || 0);
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'budget':
          return BUDGET_ORDER.indexOf(b.budget) - BUDGET_ORDER.indexOf(a.budget);
        default:
          return 0;
      }
    });

    return withScores;
  }, [preferences, sortBy, filterBudget, filterLocation]);

  const getMatchBadge = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'bg-green-500', textColor: 'text-white' };
    if (score >= 70) return { label: 'Good', color: 'bg-blue-500', textColor: 'text-white' };
    if (score >= 50) return { label: 'Decent', color: 'bg-yellow-500', textColor: 'text-white' };
    return { label: 'Poor', color: 'bg-gray-400', textColor: 'text-white' };
  };

  const getTimelineBadge = (status: string) => {
    switch (status) {
      case 'ready-to-start': return { label: 'Ready to Start', color: 'bg-green-100 text-green-800' };
      case 'interviewing': return { label: 'Interviewing', color: 'bg-blue-100 text-blue-800' };
      case 'planning': return { label: 'Planning', color: 'bg-yellow-100 text-yellow-800' };
      default: return { label: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const handleSendMessage = (project: HomeownerProject) => {
    // For demo purposes, show an alert
    alert(`Send message to ${project.homeownerName} about "${project.projectName}":\n\nHi ${project.homeownerName}, I think your ${project.projectName} project aligns perfectly with my expertise. I'd love to connect and discuss how I can help bring your vision to life!`);
  };

  if (!preferences) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-8 text-center"
      >
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FaSearch className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Set Your Preferences First</h3>
        <p className="text-gray-600">
          Complete your lead preferences above to see matching homeowner projects.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header and Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Matching Projects</h2>
            <p className="text-gray-600">
              {processedProjects.length} project{processedProjects.length !== 1 ? 's' : ''} found
            </p>
          </div>
          
          <div className="flex gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'match' | 'recent' | 'budget')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="match">Sort by Match Score</option>
              <option value="recent">Sort by Most Recent</option>
              <option value="budget">Sort by Budget</option>
            </select>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterBudget}
            onChange={(e) => setFilterBudget(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Budgets</option>
            {BUDGET_ORDER.map(budget => (
              <option key={budget} value={budget}>{budget}</option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="Filter by location..."
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 max-w-xs"
          />
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {processedProjects.map((project, index) => {
          const matchBadge = getMatchBadge(project.matchScore || 0);
          const timelineBadge = getTimelineBadge(project.timelineStatus);
          
          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {project.projectName}
                    </h3>
                    <p className="text-gray-600 text-sm">by {project.homeownerName}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${matchBadge.color} ${matchBadge.textColor}`}>
                      {project.matchScore}% {matchBadge.label}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${timelineBadge.color}`}>
                    {timelineBadge.label}
                  </span>
                  {project.aiEnabled && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      AI Guided
                    </span>
                  )}
                </div>

                <p className="text-gray-700 text-sm leading-relaxed">
                  {project.description}
                </p>
              </div>

              {/* Details */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <FaDollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-700">{project.budget}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaMapMarkerAlt className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">{project.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaHome className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-gray-700">
                      {project.rooms.join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaBookmark className="w-4 h-4 text-orange-600" />
                    <span className="text-sm text-gray-700">
                      {project.savedPosts} saves
                    </span>
                  </div>
                </div>

                {/* Styles */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Preferred Styles:</p>
                  <div className="flex flex-wrap gap-1">
                    {project.styles.map(style => (
                      <span key={style} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {style}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleSendMessage(project)}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                >
                  <FaEnvelope className="w-4 h-4" />
                  Send Message
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {processedProjects.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaSearch className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Projects Found</h3>
          <p className="text-gray-600">
            Try adjusting your filters or check back later for new projects.
          </p>
        </div>
      )}

      {/* Message functionality will be enhanced in future updates */}
    </motion.div>
  );
} 