'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { 
  FaInstagram, FaGlobe, FaEnvelope, FaPhone, FaCalendarAlt, 
  FaUserPlus, FaBookmark, FaAward, FaMedal, FaStar, FaTrophy,
  FaPlay, FaImages, FaVideo, FaNewspaper, FaLayerGroup, FaSms,
  FaArrowRight, FaQuoteLeft, FaExternalLinkAlt, FaUser, FaUsers,
  FaFileAlt, FaChevronLeft, FaChevronRight, FaTh
} from 'react-icons/fa';
import Navigation from '../../../components/Navigation';

// Enhanced mock data with Fibonacci-inspired content organization
const designerData = {
  name: 'Diana Matta',
  title: 'Principal Designer',
  location: 'San Francisco, CA',
  studio: 'Matta Design Studio',
  experience: 15,
  followers: '12.5k',
  following: '892',
  projects: '156',
  bio: 'Award-winning interior designer creating timeless, sophisticated spaces. With over 15 years of experience, Diana has transformed hundreds of residential and commercial spaces across the West Coast, specializing in sustainable luxury design.',
  profileImage: '/images/designers/diana-matta.jpg',
  social: {
    instagram: 'https://instagram.com/dianamatta',
    website: 'https://dianamatta.com',
  },
  badges: [
    { type: 'platform', name: 'Top 10 Designer', icon: '🏆' },
    { type: 'platform', name: "Editor's Pick", icon: '⭐' },
    { type: 'media', name: 'AD Featured', icon: '/images/badges/ad.png' },
    { type: 'media', name: 'Elle Decor', icon: '/images/badges/elle.png' },
  ],
  featuredProjects: [
    {
      id: 1,
      title: 'Modern Coastal Villa',
      image: '/images/projects/coastal-villa.jpg',
      link: '/project/coastal-villa',
      category: 'Residential',
      size: 'large', // For Fibonacci grid
      year: '2024'
    },
    {
      id: 2,
      title: 'Urban Loft Transformation',
      image: '/images/projects/urban-loft.jpg',
      link: '/project/urban-loft',
      category: 'Residential',
      size: 'medium',
      year: '2024'
    },
    {
      id: 3,
      title: 'Sustainable Family Home',
      image: '/images/projects/family-home.jpg',
      link: '/project/family-home',
      category: 'Residential',
      size: 'small',
      year: '2023'
    },
    {
      id: 4,
      title: 'Corporate Headquarters',
      image: '/images/projects/office.jpg',
      link: '/project/office',
      category: 'Commercial',
      size: 'medium',
      year: '2023'
    },
    {
      id: 5,
      title: 'Boutique Hotel Lobby',
      image: '/images/projects/hotel.jpg',
      link: '/project/hotel',
      category: 'Hospitality',
      size: 'large',
      year: '2023'
    },
    {
      id: 6,
      title: 'Farm-to-Table Restaurant',
      image: '/images/projects/restaurant.jpg',
      link: '/project/restaurant',
      category: 'Commercial',
      size: 'small',
      year: '2022'
    },
  ],
  designFilms: [
    {
      id: 1,
      title: 'Inside Diana\'s Design Process',
      thumbnail: '/images/videos/design-process.jpg',
      duration: '12:34',
      views: '45.2k',
      featured: true
    },
    {
      id: 2,
      title: 'Sustainable Design Philosophy',
      thumbnail: '/images/videos/sustainability.jpg',
      duration: '8:45',
      views: '32.1k',
      featured: false
    },
    {
      id: 3,
      title: 'Client Transformation Stories',
      thumbnail: '/images/videos/transformations.jpg',
      duration: '15:22',
      views: '67.8k',
      featured: true
    },
  ],
  team: [
    {
      id: 1,
      name: 'Sarah Chen',
      role: 'Senior Design Associate',
      image: '/images/team/sarah-chen.jpg',
      bio: 'Specializes in residential interiors and color theory. 8 years experience.',
      featured: true
    },
    {
      id: 2,
      name: 'Marcus Rodriguez',
      role: 'Project Manager',
      image: '/images/team/marcus-rodriguez.jpg',
      bio: 'Ensures seamless project execution from concept to completion.',
      featured: false
    },
    {
      id: 3,
      name: 'Emily Foster',
      role: 'Junior Designer',
      image: '/images/team/emily-foster.jpg',
      bio: 'Recent graduate with fresh perspectives on sustainable design.',
      featured: false
    },
    {
      id: 4,
      name: 'David Kim',
      role: 'Technical Designer',
      image: '/images/team/david-kim.jpg',
      bio: 'Expert in space planning and technical documentation.',
      featured: true
    },
  ],
  editorials: [
    {
      id: 1,
      coverImage: '/images/editorials/ad-feature.jpg',
      title: 'The New California Modern',
      publication: 'Architectural Digest',
      date: '2024',
      excerpt: 'Diana Matta redefines West Coast living with her latest residential project...',
      featured: true
    },
    {
      id: 2,
      coverImage: '/images/editorials/elle-decor.jpg',
      title: 'Sustainable Luxury Design',
      publication: 'Elle Decor',
      date: '2024',
      excerpt: 'How to create luxurious spaces while maintaining environmental consciousness...',
      featured: false
    },
    {
      id: 3, 
      coverImage: '/images/editorials/dwell-feature.jpg',
      title: 'The Art of Minimalist Living',
      publication: 'Dwell Magazine',
      date: '2023',
      excerpt: 'Exploring the philosophy behind less-is-more design...',
      featured: true
    },
  ],
  contact: {
    email: 'hello@dianamatta.com',
    phone: '+1 (415) 555-0123',
  },
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
const FibonacciProjectGrid = () => (
  <div className="grid grid-cols-8 gap-4 auto-rows-[200px]">
    {designerData.featuredProjects.map((project, index) => {
      // Fibonacci-based sizing
      const sizeConfig = {
        large: 'col-span-5 row-span-2',
        medium: 'col-span-3 row-span-1', 
        small: 'col-span-2 row-span-1'
      };

      return (
        <motion.div
          key={project.id}
          custom={index}
          variants={spiralVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className={`${sizeConfig[project.size as keyof typeof sizeConfig]} group cursor-pointer relative overflow-hidden rounded-xl bg-gray-100`}
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
                <span className="text-white/80 text-sm">{project.year}</span>
              </div>
            </div>
          </div>
        </motion.div>
      );
    })}
  </div>
);

// Videos in Asymmetric Layout
const VideoSection = () => (
  <div className="grid grid-cols-12 gap-6">
    {/* Featured Video - Large */}
    <motion.div 
      className="col-span-8"
      variants={spiralVariants}
      initial="hidden"
      whileInView="visible"
      custom={0}
    >
      {designerData.designFilms.filter(v => v.featured)[0] && (
        <div className="relative aspect-video group cursor-pointer rounded-xl overflow-hidden">
          <Image
            src={designerData.designFilms.filter(v => v.featured)[0].thumbnail}
            alt={designerData.designFilms.filter(v => v.featured)[0].title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-white bg-opacity-90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FaPlay className="w-8 h-8 text-gray-800 ml-2" />
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-white text-xl font-bold mb-2">
              {designerData.designFilms.filter(v => v.featured)[0].title}
            </h3>
            <div className="flex justify-between items-center">
              <span className="text-white/80">{designerData.designFilms.filter(v => v.featured)[0].views} views</span>
              <span className="text-white/80">{designerData.designFilms.filter(v => v.featured)[0].duration}</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>

    {/* Smaller Videos - Stacked */}
    <div className="col-span-4 space-y-4">
      {designerData.designFilms.filter(v => !v.featured).map((video, index) => (
        <motion.div
          key={video.id}
          variants={spiralVariants}
          initial="hidden"
          whileInView="visible"
          custom={index + 1}
          className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
        >
          <div className="relative w-24 h-16 flex-shrink-0 rounded-lg overflow-hidden">
            <Image
              src={video.thumbnail}
              alt={video.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                <FaPlay className="w-2 h-2 text-gray-800 ml-0.5" />
              </div>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
              {video.title}
            </h4>
            <p className="text-xs text-gray-500">{video.views} views</p>
            <p className="text-xs text-gray-400">{video.duration}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

// About Section with Floating Elements
const AboutSection = () => (
  <div className="grid grid-cols-12 gap-8">
    {/* Main Bio */}
    <motion.div 
      className="col-span-8"
      variants={spiralVariants}
      initial="hidden"
      whileInView="visible"
      custom={0}
    >
      <div className="relative">
        <FaQuoteLeft className="w-12 h-12 text-blue-600/20 absolute -top-4 -left-4" />
        <p className="text-xl text-gray-700 leading-relaxed pl-8">
          {designerData.bio}
        </p>
      </div>
    </motion.div>

    {/* Floating Awards */}
    <motion.div 
      className="col-span-3 col-start-10"
      variants={spiralVariants}
      initial="hidden"
      whileInView="visible"
      custom={1}
    >
      <h3 className="text-lg font-bold text-gray-900 mb-4">Recognition</h3>
      <div className="space-y-3">
        {designerData.badges.map((badge, index) => (
          <motion.div
            key={index}
            className="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            whileHover={{ x: 8 }}
          >
            {badge.icon.startsWith('/') ? (
              <Image src={badge.icon} alt={badge.name} width={24} height={24} />
            ) : (
              <span className="text-2xl">{badge.icon}</span>
            )}
            <span className="text-sm font-medium text-gray-700">{badge.name}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  </div>
);

// Team with Golden Ratio Layout
const TeamSection = () => (
  <div className="grid grid-cols-12 gap-6">
    {/* Featured Team Members - Large */}
    <div className="col-span-8 grid grid-cols-2 gap-6">
      {designerData.team.filter(member => member.featured).map((member, index) => (
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
      {designerData.team.filter(member => !member.featured).map((member, index) => (
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
const PressSection = () => (
  <div className="grid grid-cols-12 gap-6">
    {/* Featured Editorial */}
    <motion.div 
      className="col-span-7"
      variants={spiralVariants}
      initial="hidden"
      whileInView="visible"
      custom={0}
    >
      {designerData.editorials.filter(e => e.featured)[0] && (
        <div className="group cursor-pointer">
          <div className="relative aspect-[4/3] mb-4 rounded-xl overflow-hidden">
            <Image
              src={designerData.editorials.filter(e => e.featured)[0].coverImage}
              alt={designerData.editorials.filter(e => e.featured)[0].title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="flex items-center mb-3">
            <FaNewspaper className="w-4 h-4 text-blue-600 mr-2" />
            <span className="text-sm font-medium text-blue-600">
              {designerData.editorials.filter(e => e.featured)[0].publication}
            </span>
            <span className="text-sm text-gray-400 ml-2">
              {designerData.editorials.filter(e => e.featured)[0].date}
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
            {designerData.editorials.filter(e => e.featured)[0].title}
          </h3>
          <p className="text-gray-600 leading-relaxed">
            {designerData.editorials.filter(e => e.featured)[0].excerpt}
          </p>
        </div>
      )}
    </motion.div>

    {/* Other Editorials */}
    <div className="col-span-5 space-y-6">
      {designerData.editorials.filter(e => !e.featured).map((editorial, index) => (
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
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [direction, setDirection] = useState(0);

  const { scrollY } = useScroll();
  const sidebarY = useTransform(scrollY, [0, 1000], [0, -100]);

  const tabs = [
    { id: 'projects' as TabType, label: 'Projects', icon: FaTh },
    { id: 'videos' as TabType, label: 'Videos', icon: FaVideo },
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
    switch (activeTab) {
      case 'projects':
        return <FibonacciProjectGrid />;
      case 'videos':
        return <VideoSection />;
      case 'about':
        return <AboutSection />;
      case 'team':
        return <TeamSection />;
      case 'press':
        return <PressSection />;
      default:
        return <FibonacciProjectGrid />;
    }
  };

  return (
    <div className="min-h-screen bg-primary flex">
      {/* Navigation */}
      <Navigation />
      
      {/* Main Content */}
      <div className="flex-1 lg:ml-20 xl:ml-56">
        {/* Main Fibonacci Grid Layout */}
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
              {/* Profile Image */}
              <motion.div 
                className="relative w-32 h-32 mx-auto mb-6"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <Image
                  src={designerData.profileImage}
                  alt={designerData.name}
                  fill
                  className="rounded-full object-cover shadow-xl"
                />
              </motion.div>

              {/* Name & Title */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{designerData.name}</h1>
                <p className="text-gray-600 mb-1">{designerData.title}</p>
                <p className="text-gray-500 text-sm">{designerData.location}</p>
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
                  <a href={`mailto:${designerData.contact.email}`} className="text-gray-700 hover:text-blue-600 transition-colors text-sm">
                    {designerData.contact.email}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <FaPhone className="w-4 h-4 text-blue-600" />
                  <a href={`tel:${designerData.contact.phone}`} className="text-gray-700 hover:text-blue-600 transition-colors text-sm">
                    {designerData.contact.phone}
                  </a>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex gap-4 justify-center">
                <a href={designerData.social.instagram} target="_blank" rel="noopener noreferrer">
                  <FaInstagram className="w-6 h-6 text-gray-600 hover:text-pink-600 transition-colors" />
                </a>
                <a href={designerData.social.website} target="_blank" rel="noopener noreferrer">
                  <FaGlobe className="w-6 h-6 text-gray-600 hover:text-blue-600 transition-colors" />
                </a>
              </div>
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