'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaStar, FaPlus, FaEdit, FaEye, FaHeart, FaComment, FaShare, FaDownload, FaGlobe, FaLock, FaImage, FaVideo, FaFileAlt } from 'react-icons/fa';
import { useRole } from '../../../contexts/RoleContext';

// Mock portfolio data
const portfolioData = {
  student: {
    name: 'Alex Chen',
    school: 'Parsons School of Design',
    graduationYear: 2025,
    designFocus: 'Sustainable Interior Design',
    bio: 'Passionate about creating beautiful, sustainable spaces that improve people\'s lives while protecting our planet.',
    avatar: 'AC',
    stats: {
      projects: 8,
      views: 1240,
      likes: 89,
      followers: 34
    },
    skills: ['Space Planning', 'Sustainable Design', 'Color Theory', '3D Modeling', 'Hand Sketching'],
    contact: {
      email: 'alex.chen@student.parsons.edu',
      website: 'alexchen.design',
      linkedin: 'alexchen-design'
    }
  },
  projects: [
    {
      id: 1,
      title: 'Eco-Friendly Studio Apartment',
      category: 'Residential',
      type: 'Real Project',
      description: 'A 450 sq ft studio apartment redesigned using sustainable materials and space-saving solutions.',
      image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80'
      ],
      tags: ['Sustainable', 'Small Space', 'Budget-Friendly'],
      likes: 45,
      comments: 8,
      views: 234,
      featured: true,
      status: 'published',
      dateCreated: '2024-01-15',
      feedback: [
        {
          author: 'Sarah Martinez',
          title: 'Design Mentor',
          comment: 'Excellent use of vertical space! The color palette creates a calming atmosphere.',
          rating: 5,
          date: '2024-01-20'
        },
        {
          author: 'Mike Johnson',
          title: 'Fellow Student',
          comment: 'Love the sustainable material choices. Where did you source the reclaimed wood?',
          rating: 4,
          date: '2024-01-18'
        }
      ]
    },
    {
      id: 2,
      title: 'Modern Kitchen Redesign',
      category: 'Kitchen',
      type: 'Class Project',
      description: 'A complete kitchen renovation focusing on functionality and modern aesthetics.',
      image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80'
      ],
      tags: ['Modern', 'Functional', 'Kitchen Design'],
      likes: 32,
      comments: 5,
      views: 189,
      featured: false,
      status: 'published',
      dateCreated: '2024-01-10',
      feedback: [
        {
          author: 'Emma Rodriguez',
          title: 'Kitchen Specialist',
          comment: 'Great workflow design! The island placement maximizes efficiency.',
          rating: 5,
          date: '2024-01-12'
        }
      ]
    },
    {
      id: 3,
      title: 'Biophilic Office Space',
      category: 'Commercial',
      type: 'Personal Project',
      description: 'An office design concept incorporating natural elements to improve wellbeing and productivity.',
      image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80'
      ],
      tags: ['Biophilic', 'Office Design', 'Wellbeing'],
      likes: 28,
      comments: 3,
      views: 156,
      featured: false,
      status: 'draft',
      dateCreated: '2024-02-01',
      feedback: []
    }
  ]
};

export default function StudentPortfolio() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedProject, setSelectedProject] = useState(null);
  const [filter, setFilter] = useState('all');

  // Redirect if not student
  useEffect(() => {
    if (role && role !== 'student') {
      window.location.href = '/';
    }
  }, [role]);

  if (role !== 'student') {
    return <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
        <p className="text-gray-600">This page is only available for students.</p>
      </div>
    </div>;
  }

  const filteredProjects = filter === 'all' 
    ? portfolioData.projects 
    : portfolioData.projects.filter(project => 
        project.category.toLowerCase() === filter.toLowerCase() ||
        project.type.toLowerCase().includes(filter.toLowerCase())
      );

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-8"
      >
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {portfolioData.student.avatar}
          </div>
          
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{portfolioData.student.name}</h2>
            <p className="text-gray-600 mb-2">{portfolioData.student.school} • Class of {portfolioData.student.graduationYear}</p>
            <p className="text-blue-600 font-medium mb-4">{portfolioData.student.designFocus}</p>
            <p className="text-gray-700 mb-6">{portfolioData.student.bio}</p>
            
            {/* Skills */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Skills & Expertise</h4>
              <div className="flex flex-wrap gap-2">
                {portfolioData.student.skills.map((skill) => (
                  <span key={skill} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Contact Info */}
            <div className="flex gap-4 text-sm">
              <a href={`mailto:${portfolioData.student.contact.email}`} className="text-blue-600 hover:text-blue-700">
                {portfolioData.student.contact.email}
              </a>
              <a href={`https://${portfolioData.student.contact.website}`} className="text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <FaGlobe className="w-3 h-3" />
                {portfolioData.student.contact.website}
              </a>
            </div>
          </div>

          <div className="text-right">
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors mb-3">
              Edit Profile
            </button>
            <div className="text-sm text-gray-500">
              Portfolio views: {portfolioData.student.stats.views}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mt-8 pt-6 border-t border-gray-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{portfolioData.student.stats.projects}</div>
            <div className="text-sm text-gray-500">Projects</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{portfolioData.student.stats.views}</div>
            <div className="text-sm text-gray-500">Total Views</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{portfolioData.student.stats.likes}</div>
            <div className="text-sm text-gray-500">Total Likes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{portfolioData.student.stats.followers}</div>
            <div className="text-sm text-gray-500">Followers</div>
          </div>
        </div>
      </motion.div>

      {/* Featured Projects */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Featured Projects</h3>
          <button 
            onClick={() => setActiveTab('projects')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            View All →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {portfolioData.projects.filter(p => p.featured).map((project) => (
            <div key={project.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative h-48">
                <img src={project.image} alt={project.title} className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4">
                  <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <FaStar className="w-3 h-3" />
                    Featured
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h4 className="font-bold text-gray-900 mb-2">{project.title}</h4>
                <p className="text-gray-600 text-sm mb-3">{project.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <FaHeart className="text-red-500" />
                      {project.likes}
                    </div>
                    <div className="flex items-center gap-1">
                      <FaComment />
                      {project.comments}
                    </div>
                    <div className="flex items-center gap-1">
                      <FaEye />
                      {project.views}
                    </div>
                  </div>
                  <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const renderProjects = () => (
    <div className="space-y-6">
      {/* Project Filters and Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">My Projects</h3>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
            <FaPlus />
            New Project
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {['all', 'residential', 'kitchen', 'commercial', 'real project', 'class project', 'personal project'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all capitalize ${
                filter === filterOption
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Project Image */}
            <div className="relative h-48">
              <img src={project.image} alt={project.title} className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4 flex gap-2">
                {project.featured && (
                  <span className="bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <FaStar className="w-3 h-3" />
                    Featured
                  </span>
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  project.status === 'published' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-500 text-white'
                }`}>
                  {project.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <button className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all">
                  <FaEdit className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Project Info */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                  {project.category}
                </span>
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                  {project.type}
                </span>
              </div>

              <h4 className="font-bold text-gray-900 mb-2">{project.title}</h4>
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">{project.description}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-3">
                {project.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <FaHeart className="text-red-500" />
                    {project.likes}
                  </div>
                  <div className="flex items-center gap-1">
                    <FaComment />
                    {project.comments}
                  </div>
                  <div className="flex items-center gap-1">
                    <FaEye />
                    {project.views}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm">
                  View Details
                </button>
                <button className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors">
                  <FaShare className="w-4 h-4" />
                </button>
              </div>

              {/* Date */}
              <div className="text-xs text-gray-500 mt-2">
                Created: {new Date(project.dateCreated).toLocaleDateString()}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Project Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-200 p-8 text-center hover:border-blue-300 transition-colors cursor-pointer"
      >
        <div className="text-gray-400 mb-4">
          <FaPlus className="text-4xl mx-auto mb-4" />
        </div>
        <h4 className="text-lg font-semibold text-gray-900 mb-2">Add New Project</h4>
        <p className="text-gray-600 mb-4">Showcase your latest design work and get feedback from the community</p>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
          Create Project
        </button>
      </motion.div>
    </div>
  );

  const renderFeedback = () => (
    <div className="space-y-6">
      {/* Feedback Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
      >
        <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Feedback</h3>
        
        <div className="space-y-6">
          {portfolioData.projects.filter(p => p.feedback.length > 0).map((project) => (
            <div key={project.id} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-4 mb-4">
                <img src={project.image} alt={project.title} className="w-16 h-16 rounded-lg object-cover" />
                <div>
                  <h4 className="font-bold text-gray-900">{project.title}</h4>
                  <p className="text-sm text-gray-600">{project.feedback.length} feedback{project.feedback.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="space-y-4">
                {project.feedback.map((feedback, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {feedback.author[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{feedback.author}</span>
                          <span className="text-sm text-gray-500">{feedback.title}</span>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <FaStar 
                                key={i} 
                                className={`w-3 h-3 ${i < feedback.rating ? 'text-yellow-500' : 'text-gray-300'}`} 
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-gray-700 mb-2">{feedback.comment}</p>
                        <div className="text-sm text-gray-500">{feedback.date}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-primary flex">
      
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Portfolio</h1>
            <p className="text-gray-600">Build and showcase your design work to the community</p>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex gap-4">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'projects', label: 'Projects' },
                { id: 'feedback', label: 'Feedback' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Tab Content */}
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'projects' && renderProjects()}
          {activeTab === 'feedback' && renderFeedback()}
        </div>
      </div>
    </div>
  );
} 