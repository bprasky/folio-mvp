'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { 
  FaInstagram, 
  FaGlobe, 
  FaEnvelope, 
  FaPhone, 
  FaMapMarkerAlt,
  FaBookmark,
  FaTimes,
  FaFolder,
  FaVideo,
  FaUser,
  FaUsers,
  FaNewspaper,
  FaExternalLinkAlt,
  FaAward
} from 'react-icons/fa';
import Navigation from '../../../components/Navigation';

// Mock data for Nu Projects
const designerData = {
  name: 'Nu Projects',
  title: 'Design & Build Specialists',
  location: 'West London, UK',
  studio: 'Nu Projects London Ltd',
  experience: 15,
  followers: '50k',
  projectsCount: 120,
  bio: 'Luxury full‑service design & build company based in West London, delivering bespoke homes from concept to completion.',
  profileImage: 'https://source.unsplash.com/random/400x400?architecture,logo,company',
  social: {
    instagram: 'https://www.instagram.com/nuprojects.co',
    website: 'https://www.nuprojects.co',
  },
  badges: [
    { type: 'media', name: 'Featured in Architectural Digest', icon: '/images/badges/ad.png', link: 'https://www.architecturaldigest.com/' },
    { type: 'media', name: 'Elle Decor Feature', icon: '/images/badges/elle.png', link: 'https://www.elledecor.com/' },
  ],
  featuredMedia: [
    { id: 1, image: 'https://source.unsplash.com/random/800x600?kitchen,industrial,london', caption: 'Industrial Kitchen, London' },
    { id: 2, image: 'https://source.unsplash.com/random/800x600?living-room,transitional,london', caption: 'Transitional Living Room, London' },
    { id: 3, image: 'https://source.unsplash.com/random/800x600?modern-living-room,london', caption: 'Modern Living Room, London' },
    { id: 4, image: 'https://source.unsplash.com/random/800x600?open-plan,layout,interior', caption: 'Open‑Plan Layout' },
    { id: 5, image: 'https://source.unsplash.com/random/800x600?bathroom,luxury,marble', caption: 'Luxury Bathroom Design' },
    { id: 6, image: 'https://source.unsplash.com/random/800x600?bedroom,master,london', caption: 'Master Bedroom Suite' },
  ],
  team: [
    { name: 'Nick Jeffries', role: 'Founder', image: 'https://source.unsplash.com/random/300x300?portrait,man,architect', bio: 'Design Director with 20+ years in luxury residential.' },
    { name: 'Sophia Romash', role: 'Managing Director', image: 'https://source.unsplash.com/random/300x300?portrait,woman,manager', bio: 'Operational and project-management specialist.' },
    { name: 'James Mitchell', role: 'Senior Designer', image: 'https://source.unsplash.com/random/300x300?portrait,man,designer', bio: 'Specializes in contemporary and minimalist interiors.' },
    { name: 'Emma Thompson', role: 'Project Manager', image: 'https://source.unsplash.com/random/300x300?portrait,woman,professional', bio: 'Ensures seamless project delivery from start to finish.' },
  ],
  editorials: [
    { coverImage: '/images/editorials/ad-feature.jpg', title: 'The New London Modern', publication: 'Architectural Digest', date: '2024', link: 'https://www.architecturaldigest.com/' },
    { coverImage: '/images/editorials/elle-decor.jpg', title: 'Sustainable Luxury Design', publication: 'Elle Decor', date: '2024', link: 'https://www.elledecor.com/' },
  ],
  contact: {
    email: 'info@nuprojects.co.uk',
    phone: '+44 20 7731 6841',
    address: '10–12 Fulham High Street, London, SW6 3LQ',
  },
};

// Type definitions
type TabType = 'projects' | 'media' | 'about' | 'team' | 'press';

// Animation variants
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0
  })
};

// SMS Modal Component
const SMSModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [message, setMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(designerData.contact.phone);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the SMS
    console.log('Sending SMS:', { to: phoneNumber, message });
    alert('Message sent successfully!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Send Message</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To: {designerData.name}
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder={`Hi ${designerData.name}, I'm interested in discussing a potential project...`}
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              Send via Text Message
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// Fibonacci Project Grid Component
const FibonacciProjectGrid = () => (
  <div className="grid grid-cols-6 auto-rows-[200px] gap-4">
    {designerData.featuredMedia.map((media, index) => {
      // Fibonacci-inspired sizing pattern
      const getSpanClass = (index: number) => {
        const patterns = [
          'col-span-3 row-span-2', // Large
          'col-span-2 row-span-1', // Medium
          'col-span-1 row-span-1', // Small
          'col-span-2 row-span-2', // Tall
          'col-span-3 row-span-1', // Wide
          'col-span-1 row-span-2', // Thin tall
        ];
        return patterns[index % patterns.length];
      };

      return (
        <motion.div
          key={media.id}
          className={`relative rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 ${getSpanClass(index)}`}
          whileHover={{ scale: 1.02 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
        >
          <Image
            src={media.image}
            alt={media.caption}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-white font-medium text-sm">{media.caption}</p>
          </div>
        </motion.div>
      );
    })}
  </div>
);

// Media Section Component
const MediaSection = () => <FibonacciProjectGrid />;

// About Section Component
const AboutSection = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="space-y-8"
  >
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      <h3 className="text-2xl font-bold text-gray-900 mb-6">About {designerData.name}</h3>
      <div className="prose prose-lg max-w-none">
        <p className="text-gray-600 leading-relaxed mb-6">
          {designerData.bio}
        </p>
        <p className="text-gray-600 leading-relaxed mb-6">
          With over {designerData.experience} years of experience in luxury residential design and construction, 
          Nu Projects has established itself as one of London's premier design-build firms. Our integrated 
          approach ensures seamless project delivery from initial concept through final completion.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Services</h4>
            <ul className="space-y-2 text-gray-600">
              <li>• Full-service design & build</li>
              <li>• Interior architecture</li>
              <li>• Luxury renovations</li>
              <li>• Project management</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Specialties</h4>
            <ul className="space-y-2 text-gray-600">
              <li>• Contemporary design</li>
              <li>• Sustainable luxury</li>
              <li>• Smart home integration</li>
              <li>• Bespoke solutions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-white rounded-2xl p-8 shadow-lg">
      <h4 className="text-xl font-bold text-gray-900 mb-4">Contact Information</h4>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <FaMapMarkerAlt className="w-5 h-5 text-blue-600" />
          <span className="text-gray-700">{designerData.contact.address}</span>
        </div>
        <div className="flex items-center gap-3">
          <FaEnvelope className="w-5 h-5 text-blue-600" />
          <a href={`mailto:${designerData.contact.email}`} className="text-gray-700 hover:text-blue-600 transition-colors">
            {designerData.contact.email}
          </a>
        </div>
        <div className="flex items-center gap-3">
          <FaPhone className="w-5 h-5 text-blue-600" />
          <a href={`tel:${designerData.contact.phone}`} className="text-gray-700 hover:text-blue-600 transition-colors">
            {designerData.contact.phone}
          </a>
        </div>
      </div>
    </div>
  </motion.div>
);

// Team Section Component
const TeamSection = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="grid grid-cols-1 md:grid-cols-2 gap-6"
  >
    {designerData.team.map((member, index) => (
      <motion.div
        key={member.name}
        className="bg-white rounded-2xl p-6 shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: index * 0.1 }}
      >
        <div className="flex items-start gap-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
            <Image
              src={member.image}
              alt={member.name}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 text-lg">{member.name}</h4>
            <p className="text-blue-600 font-medium mb-2">{member.role}</p>
            <p className="text-gray-600 text-sm leading-relaxed">{member.bio}</p>
          </div>
        </div>
      </motion.div>
    ))}
  </motion.div>
);

// Press Section Component
const PressSection = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="grid grid-cols-1 md:grid-cols-2 gap-6"
  >
    {designerData.editorials.map((editorial, index) => (
      <motion.a
        key={index}
        href={editorial.link}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 group"
        whileHover={{ scale: 1.02 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: index * 0.1 }}
      >
        <div className="relative h-48">
          <Image
            src={`https://source.unsplash.com/random/600x400?magazine,${editorial.publication.toLowerCase().replace(' ', '-')}`}
            alt={editorial.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-4 right-4">
            <FaExternalLinkAlt className="w-4 h-4 text-white opacity-70" />
          </div>
        </div>
        <div className="p-6">
          <h4 className="font-bold text-gray-900 text-lg mb-2">{editorial.title}</h4>
          <p className="text-blue-600 font-medium mb-1">{editorial.publication}</p>
          <p className="text-gray-500 text-sm">{editorial.date}</p>
        </div>
      </motion.a>
    ))}
  </motion.div>
);

export default function NuProjectsProfile() {
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [direction, setDirection] = useState(0);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  const { scrollY } = useScroll();
  const sidebarY = useTransform(scrollY, [0, 300], [0, -50]);

  const tabs = [
    { id: 'projects' as TabType, label: 'Projects', icon: FaFolder },
    { id: 'media' as TabType, label: 'Media', icon: FaVideo },
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
      case 'media':
        return <MediaSection />;
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
        {/* Main Layout */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
            {/* Sticky Sidebar */}
            <motion.aside 
              className="sticky top-24 self-start"
              style={{ y: sidebarY }}
            >
              <motion.div 
                className="bg-white rounded-2xl p-6 shadow-lg"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                {/* Profile Image */}
                <motion.div 
                  className="relative w-24 h-24 mx-auto mb-4"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                >
                  <Image
                    src={designerData.profileImage}
                    alt={designerData.name}
                    fill
                    className="rounded-full object-cover shadow-lg"
                  />
                </motion.div>

                {/* Name & Title */}
                <div className="text-center mb-4">
                  <h1 className="text-xl font-bold text-gray-900 mb-1">{designerData.name}</h1>
                  <p className="text-gray-600 text-sm mb-1">{designerData.title}</p>
                  <p className="text-gray-500 text-xs">{designerData.location}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-center">
                  <div>
                    <div className="font-bold text-gray-900">{designerData.projectsCount}</div>
                    <div className="text-xs text-gray-500">Projects</div>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{designerData.followers}</div>
                    <div className="text-xs text-gray-500">Followers</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 mb-4">
                  <motion.button
                    onClick={() => setIsMessageModalOpen(true)}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Message
                  </motion.button>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/schedule-consultation"
                      className="bg-gray-100 text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-200 transition-colors font-medium text-xs text-center"
                    >
                      Consultation
                    </Link>
                    <button className="bg-gray-100 text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-200 transition-colors">
                      <FaBookmark className="w-3 h-3 mx-auto" />
                    </button>
                  </div>
                </div>

                {/* Badges */}
                <div className="space-y-2 mb-4">
                  {designerData.badges.map((badge, index) => (
                    <motion.a
                      key={index}
                      href={badge.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                      whileHover={{ scale: 1.02 }}
                      title={badge.name}
                    >
                      <FaAward className="w-4 h-4 text-amber-600" />
                      <span className="text-xs text-gray-700 font-medium truncate">{badge.name}</span>
                      <FaExternalLinkAlt className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                    </motion.a>
                  ))}
                </div>

                {/* Social Links */}
                <div className="flex gap-3 justify-center">
                  <a href={designerData.social.instagram} target="_blank" rel="noopener noreferrer">
                    <FaInstagram className="w-5 h-5 text-gray-600 hover:text-pink-600 transition-colors" />
                  </a>
                  <a href={designerData.social.website} target="_blank" rel="noopener noreferrer">
                    <FaGlobe className="w-5 h-5 text-gray-600 hover:text-blue-600 transition-colors" />
                  </a>
                </div>
              </motion.div>
            </motion.aside>

            {/* Main Content Area */}
            <main className="space-y-6">
              {/* Tab Navigation */}
              <motion.div 
                className="bg-white rounded-2xl p-2 shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="flex">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <motion.button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-300 ${
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

              {/* Tab Content */}
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

      {/* SMS Modal */}
      <SMSModal isOpen={isMessageModalOpen} onClose={() => setIsMessageModalOpen(false)} />
    </div>
  );
} 