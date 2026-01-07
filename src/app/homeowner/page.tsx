'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { 
  FaHome, 
  FaHeart, 
  FaBookmark, 
  FaUser, 
  FaMapMarkerAlt, 
  FaCalendar,
  FaEdit,
  FaEye,
  FaShare,
  FaPlus
} from 'react-icons/fa';

// Mock data for homeowner profile
const profileData = {
  name: 'Sarah Johnson',
  location: 'San Francisco, CA',
  memberSince: 'March 2023',
  avatar: 'https://source.unsplash.com/random/200x200?portrait,woman',
  bio: 'Passionate about creating beautiful, functional living spaces. Currently renovating my Victorian home in the Mission District.',
  stats: {
    projectsCreated: 3,
    itemsSaved: 47,
    designersFollowed: 12,
    inspirationBoards: 8
  }
};

const mockProjects = [
  {
    id: 1,
    name: 'Living Room Renovation',
    status: 'In Progress',
    image: 'https://source.unsplash.com/random/400x300?living-room,modern',
    budget: '$15,000',
    timeline: '3 months',
    progress: 65,
    lastUpdated: '2 days ago'
  },
  {
    id: 2,
    name: 'Kitchen Remodel',
    status: 'Planning',
    image: 'https://source.unsplash.com/random/400x300?kitchen,renovation',
    budget: '$25,000',
    timeline: '6 months',
    progress: 20,
    lastUpdated: '1 week ago'
  },
  {
    id: 3,
    name: 'Master Bedroom Refresh',
    status: 'Completed',
    image: 'https://source.unsplash.com/random/400x300?bedroom,cozy',
    budget: '$8,000',
    timeline: '2 months',
    progress: 100,
    lastUpdated: '1 month ago'
  }
];

const mockSavedItems = [
  {
    id: 1,
    name: 'Mid-Century Modern Sofa',
    brand: 'West Elm',
    price: '$1,299',
    image: 'https://source.unsplash.com/random/300x300?sofa,modern',
    category: 'Furniture'
  },
  {
    id: 2,
    name: 'Ceramic Table Lamp',
    brand: 'CB2',
    price: '$199',
    image: 'https://source.unsplash.com/random/300x300?lamp,ceramic',
    category: 'Lighting'
  },
  {
    id: 3,
    name: 'Moroccan Area Rug',
    brand: 'Rugs USA',
    price: '$349',
    image: 'https://source.unsplash.com/random/300x300?rug,moroccan',
    category: 'Rugs'
  },
  {
    id: 4,
    name: 'Velvet Accent Chair',
    brand: 'Article',
    price: '$799',
    image: 'https://source.unsplash.com/random/300x300?chair,velvet',
    category: 'Furniture'
  }
];

export default function HomeownerProfile() {
  const [activeTab, setActiveTab] = useState<'projects' | 'saved' | 'profile'>('projects');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Planning':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
          {/* Profile Header */}
          <motion.div 
            className="bg-white rounded-2xl p-8 shadow-lg mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative w-24 h-24 rounded-full overflow-hidden">
                <Image
                  src={profileData.avatar}
                  alt={profileData.name}
                  fill
                  className="object-cover"
                />
              </div>
              
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{profileData.name}</h1>
                <div className="flex items-center gap-4 text-gray-600 mb-3">
                  <div className="flex items-center gap-1">
                    <FaMapMarkerAlt className="w-4 h-4" />
                    <span>{profileData.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FaCalendar className="w-4 h-4" />
                    <span>Member since {profileData.memberSince}</span>
                  </div>
                </div>
                <p className="text-gray-700 mb-4">{profileData.bio}</p>
                
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{profileData.stats.projectsCreated}</div>
                    <div className="text-sm text-gray-600">Projects</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-pink-600">{profileData.stats.itemsSaved}</div>
                    <div className="text-sm text-gray-600">Saved Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{profileData.stats.designersFollowed}</div>
                    <div className="text-sm text-gray-600">Designers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{profileData.stats.inspirationBoards}</div>
                    <div className="text-sm text-gray-600">Boards</div>
                  </div>
                </div>
              </div>
              
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <FaEdit className="w-4 h-4" />
                Edit Profile
              </button>
            </div>
          </motion.div>

          {/* Tab Navigation */}
          <motion.div 
            className="bg-white rounded-2xl p-2 shadow-lg mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="flex">
              {[
                { id: 'projects', label: 'My Projects', icon: FaHome },
                { id: 'saved', label: 'Saved Items', icon: FaBookmark },
                { id: 'profile', label: 'Profile Settings', icon: FaUser }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">My Projects</h2>
                  <Link 
                    href="/homeowner-demo"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FaPlus className="w-4 h-4" />
                    New Project
                  </Link>
                </div>
                
                <div className="grid gap-6">
                  {mockProjects.map((project) => (
                    <motion.div
                      key={project.id}
                      className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="relative w-full md:w-48 h-32 rounded-lg overflow-hidden">
                          <Image
                            src={project.image}
                            alt={project.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="text-xl font-bold text-gray-900">{project.name}</h3>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}>
                              {project.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <span className="text-sm text-gray-600">Budget</span>
                              <div className="font-semibold">{project.budget}</div>
                            </div>
                            <div>
                              <span className="text-sm text-gray-600">Timeline</span>
                              <div className="font-semibold">{project.timeline}</div>
                            </div>
                            <div>
                              <span className="text-sm text-gray-600">Last Updated</span>
                              <div className="font-semibold">{project.lastUpdated}</div>
                            </div>
                          </div>
                          
                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">Progress</span>
                              <span className="text-sm font-semibold">{project.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="flex gap-3">
                            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                              <FaEye className="w-4 h-4" />
                              View Details
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                              <FaShare className="w-4 h-4" />
                              Share
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'saved' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Saved Items</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {mockSavedItems.map((item) => (
                    <motion.div
                      key={item.id}
                      className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="relative h-48">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                        <button className="absolute top-3 right-3 p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                          <FaHeart className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                      
                      <div className="p-4">
                        <div className="text-xs text-gray-500 mb-1">{item.category}</div>
                        <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                        <div className="text-sm text-gray-600 mb-2">{item.brand}</div>
                        <div className="text-lg font-bold text-blue-600">{item.price}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={profileData.name}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={profileData.location}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                    <textarea
                      rows={4}
                      value={profileData.bio}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      Save Changes
                    </button>
                    <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
    </div>
  );
} 