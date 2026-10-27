'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from '@/components/FolioImage';
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
  FaPlus,
  FaUserTie
} from 'react-icons/fa';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Mock data for Individual profile
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

export default function IndividualProfile() {
  const [activeTab, setActiveTab] = useState<'projects' | 'saved' | 'profile'>('projects');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress':
        return 'bg-[var(--accent)]/10 text-[var(--accent)]';
      case 'Planning':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-surface-ground text-folio-text-secondary';
    }
  };

  return (
    <div className="min-h-screen bg-surface-canvas p-6">
      <div className="max-w-7xl mx-auto">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <RidgeCard className="p-8">
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
                  <h1 className="folio-h1 text-folio-text-primary mb-2">{profileData.name}</h1>
                  <div className="flex items-center gap-4 text-folio-text-secondary mb-3">
                    <div className="flex items-center gap-1">
                      <FaMapMarkerAlt className="w-4 h-4" />
                      <span className="folio-meta">{profileData.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FaCalendar className="w-4 h-4" />
                      <span className="folio-meta">Member since {profileData.memberSince}</span>
                    </div>
                  </div>
                  <p className="folio-body text-folio-text-secondary mb-4">{profileData.bio}</p>

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="folio-h2 text-[var(--accent)]">{profileData.stats.projectsCreated}</div>
                      <div className="folio-meta text-folio-text-secondary">Projects</div>
                    </div>
                    <div className="text-center">
                      <div className="folio-h2 text-[var(--accent)]">{profileData.stats.itemsSaved}</div>
                      <div className="folio-meta text-folio-text-secondary">Saved Items</div>
                    </div>
                    <div className="text-center">
                      <div className="folio-h2 text-[var(--accent)]">{profileData.stats.designersFollowed}</div>
                      <div className="folio-meta text-folio-text-secondary">Designers</div>
                    </div>
                    <div className="text-center">
                      <div className="folio-h2 text-[var(--accent)]">{profileData.stats.inspirationBoards}</div>
                      <div className="folio-meta text-folio-text-secondary">Boards</div>
                    </div>
                  </div>
                </div>

                <Link href="/profile">
                  <Button variant="accent">
                    <FaEdit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </Link>
              </div>
            </RidgeCard>
          </motion.div>

          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <RidgeCard className="p-2">
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
                          ? 'bg-[var(--accent)] text-white shadow-lg'
                          : 'text-folio-text-secondary hover:text-folio-text-primary hover:bg-surface-canvas'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="folio-ui font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </RidgeCard>
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
                  <h2 className="folio-h2 text-folio-text-primary">My Projects</h2>
                  <Link href="/individual-demo">
                    <Button variant="accent">
                      <FaPlus className="w-4 h-4 mr-2" />
                      New Project
                    </Button>
                  </Link>
                </div>

                <div className="grid gap-6">
                  {mockProjects.map((project) => (
                    <motion.div
                      key={project.id}
                      whileHover={{ scale: 1.01 }}
                    >
                      <RidgeCard className="p-6">
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
                              <h3 className="folio-h3 text-folio-text-primary">{project.name}</h3>
                              <span className={`px-3 py-1 rounded-full folio-meta font-medium ${getStatusColor(project.status)}`}>
                                {project.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <span className="folio-meta text-folio-text-secondary">Budget</span>
                                <div className="folio-ui font-semibold text-folio-text-primary">{project.budget}</div>
                              </div>
                              <div>
                                <span className="folio-meta text-folio-text-secondary">Timeline</span>
                                <div className="folio-ui font-semibold text-folio-text-primary">{project.timeline}</div>
                              </div>
                              <div>
                                <span className="folio-meta text-folio-text-secondary">Last Updated</span>
                                <div className="folio-ui font-semibold text-folio-text-primary">{project.lastUpdated}</div>
                              </div>
                            </div>

                            <div className="mb-4">
                              <div className="flex justify-between items-center mb-2">
                                <span className="folio-meta text-folio-text-secondary">Progress</span>
                                <span className="folio-meta font-semibold text-folio-text-primary">{project.progress}%</span>
                              </div>
                              <div className="w-full bg-surface-canvas rounded-full h-2">
                                <div
                                  className="bg-[var(--accent)] h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${project.progress}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <Button variant="accent">
                                <FaEye className="w-4 h-4 mr-2" />
                                View Details
                              </Button>
                              <Button variant="secondary">
                                <FaShare className="w-4 h-4 mr-2" />
                                Share
                              </Button>
                            </div>
                          </div>
                        </div>
                      </RidgeCard>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'saved' && (
              <div className="space-y-6" data-demo-id="saved-items">
                <div className="flex justify-between items-center">
                  <h2 className="folio-h2 text-folio-text-primary">Saved Items</h2>
                  <Link href="/individual/hire">
                    <Button variant="accent">
                      <FaUserTie className="w-4 h-4 mr-2" />
                      Hire a Designer
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {mockSavedItems.map((item) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ scale: 1.02 }}
                    >
                      <RidgeCard className="overflow-hidden">
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
                          <div className="folio-meta text-folio-text-tertiary mb-1">{item.category}</div>
                          <h3 className="folio-ui font-semibold text-folio-text-primary mb-1">{item.name}</h3>
                          <div className="folio-meta text-folio-text-secondary mb-2">{item.brand}</div>
                          <div className="folio-h3 text-[var(--accent)]">{item.price}</div>
                        </div>
                      </RidgeCard>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <RidgeCard className="p-8">
                <h2 className="folio-h2 text-folio-text-primary mb-6">Profile Settings</h2>

                <div className="space-y-6">
                  <div>
                    <label className="block folio-ui font-medium text-folio-text-secondary mb-2">Full Name</label>
                    <Input
                      type="text"
                      defaultValue={profileData.name}
                    />
                  </div>

                  <div>
                    <label className="block folio-ui font-medium text-folio-text-secondary mb-2">Location</label>
                    <Input
                      type="text"
                      defaultValue={profileData.location}
                    />
                  </div>

                  <div>
                    <label className="block folio-ui font-medium text-folio-text-secondary mb-2">Bio</label>
                    <textarea
                      rows={4}
                      defaultValue={profileData.bio}
                      className="w-full px-4 py-3 bg-surface-canvas border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none folio-body text-folio-text-primary"
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button variant="accent">
                      Save Changes
                    </Button>
                    <Button variant="secondary">
                      Cancel
                    </Button>
                  </div>
                </div>
              </RidgeCard>
            )}
          </motion.div>
      </div>
    </div>
  );
}
