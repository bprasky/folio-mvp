'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { 
  FaInstagram, FaGlobe, FaEnvelope, FaPhone, FaCalendarAlt, 
  FaUserPlus, FaBookmark, FaAward, FaMedal, FaStar, FaTrophy,
  FaPlay, FaImages, FaVideo, FaNewspaper, FaLayerGroup, FaSms,
  FaArrowRight, FaQuoteLeft, FaExternalLinkAlt, FaUser, FaUsers,
  FaFileAlt, FaChevronLeft, FaChevronRight, FaTh, FaPlus, FaEdit, FaSave, FaTimes
} from 'react-icons/fa';
import VideoUploader from '../../../components/VideoUploader';
import { hrefForProject, isPublished } from '@/lib/projectRoutes';

// Default/fallback data structure
const defaultDesignerData = {
  name: '',
  title: '',
  location: '',
  studio: '',
  bio: '',
  profileImage: '/images/product-placeholder.jpg',
  website: '',
  instagram: '',
  phone: '',
  email: '',
  followers: 0,
  following: 0,
  projects: '0',
  specialties: [],
  featuredProjects: [],
  designFilms: [],
  team: [],
  editorials: [],
};

// Tab types
type TabType = 'projects' | 'videos' | 'about' | 'team' | 'press';

// Animation variants with Fibonacci-inspired timing
const fibonacciDelays = [0, 0.1, 0.2, 0.3, 0.5, 0.8, 1.3]; // Fibonacci sequence for delays

const spiralVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8,
    x: -100,
    y: 100
  },
  visible: (custom: number) => ({
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    transition: {
      delay: fibonacciDelays[custom % fibonacciDelays.length],
      duration: 0.8,
      ease: "easeOut"
    }
  })
};

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 300 : -300,
    opacity: 0
  })
};

// Enhanced SMS Modal Component
const SMSModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('SMS functionality will be integrated with Twilio in production.');
    console.log('SMS Data:', formData);
    onClose();
    setFormData({ name: '', phone: '', message: '' });
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <div className="flex items-center mb-6">
          <FaSms className="w-6 h-6 text-blue-600 mr-3" />
          <h3 className="text-xl font-bold text-gray-900">Send a Text Message</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              required
              rows={3}
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Hi Diana, I'd love to discuss a potential project..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Send via Text Message
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-500 mt-4 text-center">
          We'll respond within 24 hours during business days
        </p>
      </motion.div>
    </motion.div>
  );
};

// Fibonacci-inspired Project Grid
const FibonacciProjectGrid = ({ designerData }: any) => {
  if (!designerData?.featuredProjects || designerData.featuredProjects.length === 0) {
    return (
      <div className="text-center py-16">
        <FaImages className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
        <p className="text-gray-600">Create your first project to showcase your work</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-8 gap-4 auto-rows-[200px]">
      {designerData.featuredProjects.map((project: any, index: number) => {
        // Fibonacci-based sizing
        const sizeConfig = {
          large: 'col-span-5 row-span-2',
          medium: 'col-span-3 row-span-1', 
          small: 'col-span-2 row-span-1'
        };

        const href = hrefForProject(project);
        const published = isPublished(project);

        return (
          <Link
            key={project.id}
            href={href}
            aria-label={published ? `View ${project.title}` : `Continue setup for ${project.title}`}
          >
            <motion.div
              custom={index}
              variants={spiralVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className={`${sizeConfig[project.size as keyof typeof sizeConfig]} group cursor-pointer relative overflow-hidden rounded-xl bg-gray-100 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2`}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <Image
                src={project.image}
                alt={project.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white font-semibold mb-1">{project.title}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80 text-sm">{project.category}</span>
                    <span className="text-white/80 text-sm">
                      {published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
              </div>
              {!published && (
                <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                  Draft
                </div>
              )}
            </motion.div>
          </Link>
        );
      })}
    </div>
  );
};

// Enhanced Videos Section with Channel Features
const VideoSection = () => {
  const [videos, setVideos] = useState([]);
  const [showUploader, setShowUploader] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDesignerVideos();
  }, []);

  const loadDesignerVideos = async () => {
    try {
      const response = await fetch('/api/videos/upload?creatorId=designer-1&creatorType=designer');
      const data = await response.json();
      
      if (data.success) {
        setVideos(data.videos);
      }
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoUpload = (newVideo: any) => {
    setVideos([newVideo, ...videos]);
    setShowUploader(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Channel Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Channel</h2>
          <p className="text-gray-600">Share your design process and insights</p>
        </div>
        <button
          onClick={() => setShowUploader(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <FaPlus className="w-4 h-4" />
          Upload Video
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <FaVideo className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No videos yet</h3>
          <p className="text-gray-600 mb-4">Start building your channel by uploading your first video</p>
          <button
            onClick={() => setShowUploader(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Upload First Video
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Featured Video - Large */}
          <motion.div 
            className="col-span-8"
            variants={spiralVariants}
            initial="hidden"
            whileInView="visible"
            custom={0}
          >
            {videos[0] && (
              <Link href={`/watch/${videos[0].id}`}>
                <div className="relative aspect-video group cursor-pointer rounded-xl overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <FaPlay className="w-12 h-12 text-white opacity-80" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-white bg-opacity-90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <FaPlay className="w-8 h-8 text-gray-800 ml-2" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white text-xl font-bold mb-2">
                      {videos[0].title}
                    </h3>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">{videos[0].views} views</span>
                      <span className="text-white/80">{new Date(videos[0].createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </motion.div>

          {/* Smaller Videos - Stacked */}
          <div className="col-span-4 space-y-3">
            {videos.slice(1, 4).map((video, index) => (
              <motion.div
                key={video.id}
                variants={spiralVariants}
                initial="hidden"
                whileInView="visible"
                custom={index + 1}
              >
                <Link href={`/watch/${video.id}`}>
                  <div className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">
                    <div className="relative w-24 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        <FaPlay className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
                        {video.title}
                      </h4>
                      <p className="text-xs text-gray-500">{video.views} views</p>
                      <p className="text-xs text-gray-400">{new Date(video.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      {showUploader && (
        <VideoUploader
          creatorId="designer-1"
          creatorType="designer"
          onUploadComplete={handleVideoUpload}
          onClose={() => setShowUploader(false)}
          projects={[]}
        />
      )}
    </div>
  );
};

// About Section with Floating Elements
const AboutSection = ({ designerData, isEditing, setDesignerData }: any) => (
  <div className="grid grid-cols-12 gap-8">
    {/* Main Bio */}
    <motion.div 
      className="col-span-12"
      variants={spiralVariants}
      initial="hidden"
      whileInView="visible"
      custom={0}
    >
      <div className="relative">
        {!isEditing && <FaQuoteLeft className="w-12 h-12 text-blue-600/20 absolute -top-4 -left-4" />}
        {isEditing ? (
          <textarea
            value={designerData.bio || ''}
            onChange={(e) => setDesignerData({ ...designerData, bio: e.target.value })}
            className="w-full text-xl text-gray-700 border border-gray-300 rounded-lg px-4 py-3 min-h-[200px] leading-relaxed"
            placeholder="Tell your story... What's your design philosophy? What makes your work unique?"
          />
        ) : (
          <p className="text-xl text-gray-700 leading-relaxed pl-8">
            {designerData.bio || 'Add your bio to tell your story...'}
          </p>
        )}
      </div>
    </motion.div>
  </div>
);

// Team with Golden Ratio Layout
const TeamSection = ({ designerData }: any) => (
  <div className="grid grid-cols-12 gap-6">
    {/* Featured Team Members - Large */}
    <div className="col-span-8 grid grid-cols-2 gap-6">
      {(designerData?.team || []).filter((member: any) => member.featured).map((member: any, index: number) => (
        <motion.div
          key={member.id}
          variants={spiralVariants}
          initial="hidden"
          whileInView="visible"
          custom={index}
          className="text-center group"
          whileHover={{ y: -8 }}
        >
          <div className="relative w-32 h-32 mx-auto mb-4 overflow-hidden rounded-full">
            <Image
              src={member.image}
              alt={member.name}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-500"
            />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
          <p className="text-blue-600 text-sm font-medium mb-2">{member.role}</p>
          <p className="text-gray-600 text-sm">{member.bio}</p>
        </motion.div>
      ))}
    </div>

    {/* Other Team Members - Compact */}
    <div className="col-span-4 space-y-4">
      {(designerData?.team || []).filter((member: any) => !member.featured).map((member: any, index: number) => (
        <motion.div
          key={member.id}
          variants={spiralVariants}
          initial="hidden"
          whileInView="visible"
          custom={index + 2}
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="relative w-12 h-12 flex-shrink-0 overflow-hidden rounded-full">
            <Image
              src={member.image}
              alt={member.name}
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm">{member.name}</h4>
            <p className="text-blue-600 text-xs">{member.role}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

// Press with Editorial Layout
const PressSection = ({ designerData }: any) => (
  <div className="grid grid-cols-12 gap-6">
    {/* Featured Editorial */}
    <motion.div 
      className="col-span-7"
      variants={spiralVariants}
      initial="hidden"
      whileInView="visible"
      custom={0}
    >
      {(() => {
        const featured = (designerData?.editorials || []).filter((e: any) => e.featured)[0];
        return featured ? (
          <div className="group cursor-pointer">
            <div className="relative aspect-[4/3] mb-4 rounded-xl overflow-hidden">
              <Image
                src={featured.coverImage}
                alt={featured.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="flex items-center mb-3">
              <FaNewspaper className="w-4 h-4 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-600">
                {featured.publication}
              </span>
              <span className="text-sm text-gray-400 ml-2">
                {featured.date}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
              {featured.title}
            </h3>
            <p className="text-gray-600 leading-relaxed">
              {featured.excerpt}
            </p>
          </div>
        ) : null;
      })()}
    </motion.div>

    {/* Other Editorials */}
    <div className="col-span-5 space-y-6">
      {(designerData?.editorials || []).filter((e: any) => !e.featured).map((editorial: any, index: number) => (
        <motion.div
          key={editorial.id}
          variants={spiralVariants}
          initial="hidden"
          whileInView="visible"
          custom={index + 1}
          className="flex gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
        >
          <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
            <Image
              src={editorial.coverImage}
              alt={editorial.title}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <FaNewspaper className="w-3 h-3 text-blue-600 mr-1" />
              <span className="text-xs font-medium text-blue-600">{editorial.publication}</span>
            </div>
            <h4 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors mb-1">
              {editorial.title}
            </h4>
            <p className="text-xs text-gray-500">{editorial.date}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

export default function DesignerProfile() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [direction, setDirection] = useState(0);
  const [designerData, setDesignerData] = useState<any>(defaultDesignerData);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { scrollY } = useScroll();
  const sidebarY = useTransform(scrollY, [0, 1000], [0, -100]);

  // Load designer profile from database
  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Force no-cache to ensure fresh data after project creation
        const response = await fetch('/api/designer/profile', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        if (response.ok) {
          const data = await response.json();
          setDesignerData({
            ...defaultDesignerData,
            ...data,
            social: {
              instagram: data.instagram || '',
              website: data.website || '',
            },
            contact: {
              email: data.email || '',
              phone: data.phone || '',
            },
            // Use real projects from DB
            featuredProjects: data.featuredProjects || [],
          });
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[DesignerProfile] Loaded projects:', data.featuredProjects?.length || 0);
          }
        } else {
          console.error('Failed to load profile');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [session]);

  // Save profile changes
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/designer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: designerData.name,
          title: designerData.title,
          bio: designerData.bio,
          location: designerData.location,
          studio: designerData.studio,
          phone: designerData.contact?.phone || designerData.phone,
          website: designerData.social?.website || designerData.website,
          instagram: designerData.social?.instagram || designerData.instagram,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        alert('Profile saved successfully!');
      } else {
        alert('Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'projects' as TabType, label: 'Projects', icon: FaTh },
    { id: 'videos' as TabType, label: 'Channel', icon: FaVideo },
    { id: 'about' as TabType, label: 'About', icon: FaUser },
    { id: 'team' as TabType, label: 'Team', icon: FaUsers },
    { id: 'press' as TabType, label: 'Press', icon: FaNewspaper },
  ];

  const handleTabChange = (newTab: TabType) => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    const newIndex = tabs.findIndex(tab => tab.id === newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'projects':
        return <FibonacciProjectGrid designerData={designerData} />;
      case 'videos':
        return <VideoSection />;
      case 'about':
        return <AboutSection designerData={designerData} isEditing={isEditing} setDesignerData={setDesignerData} />;
      case 'team':
        return <TeamSection designerData={designerData} />;
      case 'press':
        return <PressSection designerData={designerData} />;
      default:
        return <FibonacciProjectGrid designerData={designerData} />;
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-12 gap-8">
          {/* Sticky Sidebar - Golden Ratio Width */}
          <motion.aside 
            className="col-span-4 sticky top-24 self-start"
            style={{ y: sidebarY }}
          >
            <motion.div 
              className="bg-white rounded-2xl p-8 shadow-lg"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Edit/Save Buttons */}
              <div className="flex justify-end mb-4">
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <FaSave className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FaEdit className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Profile Image */}
              <motion.div 
                className="relative w-32 h-32 mx-auto mb-6"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <Image
                  src={designerData.profileImage || '/images/product-placeholder.jpg'}
                  alt={designerData.name || 'Designer'}
                  fill
                  className="rounded-full object-cover shadow-xl"
                />
              </motion.div>

              {/* Name & Title */}
              <div className="text-center mb-6">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={designerData.name || ''}
                      onChange={(e) => setDesignerData({ ...designerData, name: e.target.value })}
                      className="w-full text-center text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-1"
                      placeholder="Your Name"
                    />
                    <input
                      type="text"
                      value={designerData.title || ''}
                      onChange={(e) => setDesignerData({ ...designerData, title: e.target.value })}
                      className="w-full text-center text-gray-600 border border-gray-300 rounded-lg px-3 py-1"
                      placeholder="Your Title"
                    />
                    <input
                      type="text"
                      value={designerData.location || ''}
                      onChange={(e) => setDesignerData({ ...designerData, location: e.target.value })}
                      className="w-full text-center text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1"
                      placeholder="City, State"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{designerData.name || 'Your Name'}</h1>
                    <p className="text-gray-600 mb-1">{designerData.title || 'Your Title'}</p>
                    <p className="text-gray-500 text-sm">{designerData.location || 'Your Location'}</p>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                <div>
                  <div className="font-bold text-gray-900 text-lg">{designerData.projects}</div>
                  <div className="text-xs text-gray-500">Projects</div>
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-lg">{designerData.followers}</div>
                  <div className="text-xs text-gray-500">Followers</div>
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-lg">{designerData.following}</div>
                  <div className="text-xs text-gray-500">Following</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 mb-6">
                <motion.button
                  onClick={() => setIsMessageModalOpen(true)}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Send Message
                </motion.button>
                <motion.div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/schedule-consultation"
                    className="bg-gray-100 text-gray-900 px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm text-center"
                  >
                    Consult
                  </Link>
                  <button className="bg-gray-100 text-gray-900 px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors">
                    <FaBookmark className="w-4 h-4 mx-auto" />
                  </button>
                </motion.div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <FaEnvelope className="w-4 h-4 text-blue-600" />
                  {isEditing ? (
                    <input
                      type="email"
                      value={designerData.contact?.email || designerData.email || ''}
                      onChange={(e) => setDesignerData({ 
                        ...designerData, 
                        contact: { ...designerData.contact, email: e.target.value }
                      })}
                      className="flex-1 text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="your@email.com"
                    />
                  ) : (
                    <a href={`mailto:${designerData.contact?.email || designerData.email || ''}`} className="text-gray-700 hover:text-blue-600 transition-colors text-sm">
                      {designerData.contact?.email || designerData.email || 'Add email'}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <FaPhone className="w-4 h-4 text-blue-600" />
                  {isEditing ? (
                    <input
                      type="tel"
                      value={designerData.contact?.phone || designerData.phone || ''}
                      onChange={(e) => setDesignerData({ 
                        ...designerData, 
                        contact: { ...designerData.contact, phone: e.target.value }
                      })}
                      className="flex-1 text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="+1 (555) 123-4567"
                    />
                  ) : (
                    <a href={`tel:${designerData.contact?.phone || designerData.phone || ''}`} className="text-gray-700 hover:text-blue-600 transition-colors text-sm">
                      {designerData.contact?.phone || designerData.phone || 'Add phone'}
                    </a>
                  )}
                </div>
              </div>

              {/* Social Links */}
              {isEditing ? (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2">
                    <FaInstagram className="w-4 h-4 text-pink-600" />
                    <input
                      type="text"
                      value={designerData.social?.instagram || designerData.instagram || ''}
                      onChange={(e) => setDesignerData({ 
                        ...designerData, 
                        social: { ...designerData.social, instagram: e.target.value }
                      })}
                      className="flex-1 text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="Instagram URL"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <FaGlobe className="w-4 h-4 text-blue-600" />
                    <input
                      type="text"
                      value={designerData.social?.website || designerData.website || ''}
                      onChange={(e) => setDesignerData({ 
                        ...designerData, 
                        social: { ...designerData.social, website: e.target.value }
                      })}
                      className="flex-1 text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="Website URL"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 justify-center">
                  {(designerData.social?.instagram || designerData.instagram) && (
                    <a href={designerData.social?.instagram || designerData.instagram} target="_blank" rel="noopener noreferrer">
                      <FaInstagram className="w-6 h-6 text-gray-600 hover:text-pink-600 transition-colors" />
                    </a>
                  )}
                  {(designerData.social?.website || designerData.website) && (
                    <a href={designerData.social?.website || designerData.website} target="_blank" rel="noopener noreferrer">
                      <FaGlobe className="w-6 h-6 text-gray-600 hover:text-blue-600 transition-colors" />
                    </a>
                  )}
                  {!(designerData.social?.instagram || designerData.instagram || designerData.social?.website || designerData.website) && (
                    <p className="text-gray-400 text-sm">No social links yet</p>
                  )}
                </div>
              )}
            </motion.div>
          </motion.aside>

          {/* Main Content Area */}
          <main className="col-span-8">
            {/* Tab Navigation */}
            <motion.div 
              className="bg-white rounded-2xl p-2 shadow-lg mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="flex">
                {tabs.map((tab, index) => {
                  const Icon = tab.icon;
                  return (
                    <motion.button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 ${
                        activeTab === tab.id
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{tab.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Tab Content with Fibonacci Layouts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeTab}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 }
                  }}
                >
                  {renderTabContent()}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </main>
          </div>
        </div>
      </div>

      {/* Enhanced SMS Modal */}
      <SMSModal isOpen={isMessageModalOpen} onClose={() => setIsMessageModalOpen(false)} />
    </div>
  );
}