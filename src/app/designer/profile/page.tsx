'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { 
  FaInstagram, FaGlobe, FaEnvelope, FaPhone, FaCalendarAlt, 
  FaUserPlus, FaBookmark, FaAward, FaMedal, FaStar, FaTrophy,
  FaPlay, FaImages, FaVideo, FaNewspaper, FaLayerGroup, FaSms,
  FaArrowRight, FaQuoteLeft, FaExternalLinkAlt, FaUser, FaUsers,
  FaFileAlt, FaChevronLeft, FaChevronRight, FaTh, FaEdit, FaSave,
  FaTimes, FaPlus, FaTrash, FaBriefcase, FaCog, FaCamera, FaUpload,
  FaChevronDown
} from 'react-icons/fa';
import Navigation from '../../../components/Navigation';
import { useRole } from '../../../contexts/RoleContext';
import VideoUploader from '../../../components/VideoUploader';
import ProjectCreationModal from '../../../components/ProjectCreationModal';

// Multiple designer profiles
const designerProfiles = {
  'sarah-chen': {
    name: 'Sarah Chen',
    title: 'Principal Designer & Creative Director',
    location: 'San Francisco, CA',
    studio: 'Chen Design Studio',
    experience: 12,
    followers: '8.2k',
    following: '1.2k',
    projects: '89',
    bio: 'Award-winning interior designer specializing in sustainable luxury and modern residential spaces. With over 12 years of experience, I create timeless interiors that reflect my clients\' personalities while maintaining environmental consciousness.',
    profileImage: 'https://source.unsplash.com/random/400x400?designer,profile,sarah',
    social: {
      instagram: 'https://instagram.com/sarahchen_design',
      website: 'https://sarahchendesign.com',
    },
    badges: [
      { type: 'platform', name: 'Top Designer 2024', icon: '🏆' },
      { type: 'platform', name: "Editor's Choice", icon: '⭐' },
      { type: 'media', name: 'AD Featured', icon: '/images/badges/ad.png' },
      { type: 'media', name: 'Elle Decor', icon: '/images/badges/elle.png' },
    ],
    specialties: ['Sustainable Design', 'Modern Residential', 'Color Theory', 'Space Planning'],
    services: [
      { name: 'Full Home Design', price: '$150-250/sq ft', description: 'Complete interior design from concept to completion' },
      { name: 'Design Consultation', price: '$300/hour', description: 'Expert advice and design direction' },
      { name: 'Virtual Design', price: '$2,500-5,000', description: 'Remote design services with detailed plans' },
      { name: 'Styling & Staging', price: '$150/hour', description: 'Final styling and home staging services' }
    ],
    featuredProjects: [
      {
        id: 1,
        title: 'Modern Coastal Retreat',
        image: 'https://images.unsplash.com/photo-1618220179428-2279569a917e?auto=format&fit=crop&w=600&q=80',
        link: '/project/coastal-retreat',
        category: 'Residential',
        size: 'large',
        year: '2024',
        description: 'A stunning waterfront home blending modern minimalism with coastal charm.'
      },
      {
        id: 2,
        title: 'Urban Loft Transformation',
        image: 'https://images.unsplash.com/photo-1596700670868-b717b0d4b2e8?auto=format&fit=crop&w=600&q=80',
        link: '/project/urban-loft',
        category: 'Residential',
        size: 'medium',
        year: '2024',
        description: 'Converting an industrial space into a warm, livable urban sanctuary.'
      },
      {
        id: 3,
        title: 'Sustainable Family Home',
        image: 'https://images.unsplash.com/photo-1527347746400-ae06093d6e53?auto=format&fit=crop&w=600&q=80',
        link: '/project/family-home',
        category: 'Residential',
        size: 'small',
        year: '2023',
        description: 'Eco-friendly design solutions for modern family living.'
      }
    ],
    designProcess: [
      { step: 1, title: 'Discovery & Consultation', description: 'Understanding your vision, lifestyle, and project goals' },
      { step: 2, title: 'Concept Development', description: 'Creating mood boards, color palettes, and initial concepts' },
      { step: 3, title: 'Design Development', description: 'Detailed plans, 3D renderings, and material selections' },
      { step: 4, title: 'Implementation', description: 'Project management and installation coordination' },
      { step: 5, title: 'Final Styling', description: 'Finishing touches and styling for the perfect reveal' }
    ],
    testimonials: [
      {
        id: 1,
        name: 'Michael Thompson',
        project: 'Palo Alto Residence',
        text: 'Sarah transformed our home beyond our wildest dreams. Her attention to detail and sustainable approach made the entire process seamless.',
        rating: 5,
        image: 'https://source.unsplash.com/random/100x100?client,testimonial'
      },
      {
        id: 2,
        name: 'Jennifer Martinez',
        project: 'SOMA Loft',
        text: 'Working with Sarah was incredible. She understood our vision perfectly and delivered a space that feels uniquely ours.',
        rating: 5,
        image: 'https://source.unsplash.com/random/100x100?client,review'
      }
    ],
    contact: {
      email: 'hello@sarahchendesign.com',
      phone: '+1 (415) 555-0198',
    },
    team: [
      {
        id: 1,
        name: 'Sarah Chen',
        role: 'Principal Designer',
        bio: '12+ years experience in luxury residential design',
        image: 'https://source.unsplash.com/random/200x200?designer,team,sarah',
        email: 'sarah@sarahchendesign.com'
      },
      {
        id: 2,
        name: 'Alex Rivera',
        role: 'Associate Designer',
        bio: 'Specializes in sustainable materials and space planning',
        image: 'https://source.unsplash.com/random/200x200?designer,team,associate',
        email: 'alex@sarahchendesign.com'
      },
      {
        id: 3,
        name: 'Maya Patel',
        role: 'Project Manager',
        bio: 'Ensures seamless project execution and client communication',
        image: 'https://source.unsplash.com/random/200x200?designer,team,project',
        email: 'maya@sarahchendesign.com'
      },
      {
        id: 4,
        name: 'Jordan Kim',
        role: 'Junior Designer',
        bio: 'Fresh perspective on modern design trends and technology',
        image: 'https://source.unsplash.com/random/200x200?designer,team,junior',
        email: 'jordan@sarahchendesign.com'
      }
    ]
  },
  'marcus-rodriguez': {
    name: 'Marcus Rodriguez',
    title: 'Modern Minimalist Designer',
    location: 'Los Angeles, CA',
    studio: 'Rodriguez Design Co.',
    experience: 8,
    followers: '5.8k',
    following: '890',
    projects: '64',
    bio: 'Minimalist designer focused on clean lines, functional spaces, and timeless aesthetics. I believe in the power of simplicity to create calm, purposeful environments.',
    profileImage: 'https://source.unsplash.com/random/400x400?designer,profile,marcus',
    social: {
      instagram: 'https://instagram.com/marcusdesigns',
      website: 'https://marcusrodriguezdesign.com',
    },
    badges: [
      { type: 'platform', name: 'Rising Star 2024', icon: '⭐' },
      { type: 'media', name: 'Dwell Featured', icon: '/images/badges/dwell.png' },
    ],
    specialties: ['Minimalist Design', 'Scandinavian Style', 'Clean Lines', 'Functional Spaces'],
    services: [
      { name: 'Minimalist Makeover', price: '$100-180/sq ft', description: 'Complete minimalist transformation' },
      { name: 'Space Optimization', price: '$250/hour', description: 'Maximize functionality in small spaces' },
      { name: 'Scandinavian Style', price: '$2,000-4,000', description: 'Nordic-inspired design solutions' }
    ],
    featuredProjects: [
      {
        id: 1,
        title: 'Minimalist Penthouse',
        image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80',
        link: '/project/minimalist-penthouse',
        category: 'Residential',
        size: 'large',
        year: '2024',
        description: 'Clean lines and open spaces define this urban retreat.'
      }
    ],
    designProcess: [
      { step: 1, title: 'Simplify & Declutter', description: 'Removing excess to reveal essential elements' },
      { step: 2, title: 'Function First', description: 'Prioritizing functionality in every design decision' },
      { step: 3, title: 'Quality Materials', description: 'Selecting durable, beautiful materials that age well' },
      { step: 4, title: 'Light & Space', description: 'Maximizing natural light and sense of space' }
    ],
    testimonials: [
      {
        id: 1,
        name: 'David Kim',
        project: 'Hollywood Hills Home',
        text: 'Marcus helped us achieve the perfect balance of style and functionality. Our home feels so much more peaceful now.',
        rating: 5,
        image: 'https://source.unsplash.com/random/100x100?client,minimal'
      }
    ],
    contact: {
      email: 'hello@marcusrodriguezdesign.com',
      phone: '+1 (323) 555-0167',
    },
    team: [
      {
        id: 1,
        name: 'Marcus Rodriguez',
        role: 'Principal Designer',
        bio: '8+ years experience in minimalist design',
        image: 'https://source.unsplash.com/random/200x200?designer,team,marcus',
        email: 'marcus@marcusrodriguezdesign.com'
      },
      {
        id: 2,
        name: 'Luna Chen',
        role: 'Associate Designer',
        bio: 'Expert in Scandinavian design principles',
        image: 'https://source.unsplash.com/random/200x200?designer,team,luna',
        email: 'luna@marcusrodriguezdesign.com'
      }
    ]
  },
  'emma-thompson': {
    name: 'Emma Thompson',
    title: 'Biophilic Design Specialist',
    location: 'Portland, OR',
    studio: 'Thompson Biophilic Studio',
    experience: 10,
    followers: '7.1k',
    following: '1.5k',
    projects: '72',
    bio: 'Passionate about bringing nature indoors through biophilic design principles. I create healing spaces that connect people with the natural world.',
    profileImage: 'https://source.unsplash.com/random/400x400?designer,profile,emma',
    social: {
      instagram: 'https://instagram.com/emmathompsondesign',
      website: 'https://emmathompsonbiophilic.com',
    },
    badges: [
      { type: 'platform', name: 'Eco Designer 2024', icon: '🌱' },
      { type: 'platform', name: 'Wellness Expert', icon: '🧘' },
      { type: 'media', name: 'Architectural Digest', icon: '/images/badges/ad.png' },
    ],
    specialties: ['Biophilic Design', 'Sustainable Materials', 'Wellness Spaces', 'Natural Light'],
    services: [
      { name: 'Biophilic Transformation', price: '$120-200/sq ft', description: 'Nature-inspired design solutions' },
      { name: 'Wellness Consultation', price: '$350/hour', description: 'Creating spaces for mental and physical health' },
      { name: 'Plant Integration', price: '$1,500-3,500', description: 'Strategic plant placement and care systems' }
    ],
    featuredProjects: [
      {
        id: 1,
        title: 'Urban Jungle Loft',
        image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80',
        link: '/project/urban-jungle',
        category: 'Residential',
        size: 'large',
        year: '2024',
        description: 'A plant-filled sanctuary in the heart of the city.'
      }
    ],
    designProcess: [
      { step: 1, title: 'Nature Assessment', description: 'Understanding natural light, air flow, and plant possibilities' },
      { step: 2, title: 'Biophilic Strategy', description: 'Developing a plan to integrate natural elements' },
      { step: 3, title: 'Material Selection', description: 'Choosing sustainable, natural materials' },
      { step: 4, title: 'Living Elements', description: 'Integrating plants, water features, and natural textures' }
    ],
    testimonials: [
      {
        id: 1,
        name: 'Sarah Williams',
        project: 'Wellness Retreat Home',
        text: 'Emma created a space that truly feels like a healing sanctuary. The biophilic elements make such a difference in our daily well-being.',
        rating: 5,
        image: 'https://source.unsplash.com/random/100x100?client,wellness'
      }
    ],
    contact: {
      email: 'hello@emmathompsonbiophilic.com',
      phone: '+1 (503) 555-0142',
    },
    team: [
      {
        id: 1,
        name: 'Emma Thompson',
        role: 'Principal Designer',
        bio: '10+ years experience in biophilic design',
        image: 'https://source.unsplash.com/random/200x200?designer,team,emma',
        email: 'emma@emmathompsonbiophilic.com'
      },
      {
        id: 2,
        name: 'Oliver Green',
        role: 'Plant Specialist',
        bio: 'Expert in indoor plant systems and care',
        image: 'https://source.unsplash.com/random/200x200?designer,team,plants',
        email: 'oliver@emmathompsonbiophilic.com'
      }
    ]
  }
};

// Tab types
type TabType = 'feed' | 'projects' | 'videos' | 'team' | 'about';

// Animation variants
const fibonacciDelays = [0, 0.1, 0.2, 0.3, 0.5, 0.8, 1.3];

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

const spiralVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8,
    x: -100,
    y: 100
  },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    transition: {
      delay: fibonacciDelays[i % fibonacciDelays.length],
      duration: 0.8,
      type: "spring",
      stiffness: 100,
      damping: 10
    }
  })
};

// Profile Photo Upload Component
const ProfilePhotoUpload = ({ currentImage, onImageChange, isEditing }: { 
  currentImage: string, 
  onImageChange: (imageUrl: string) => void,
  isEditing: boolean 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onImageChange(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative mb-6">
      <div className="relative w-32 h-32 mx-auto">
        <Image
          src={currentImage}
          alt="Profile"
          fill
          className="rounded-full object-cover"
        />
        {isEditing && (
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-opacity-60 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <FaCamera className="text-white text-xl" />
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

// User Switcher Dropdown Component
const UserSwitcher = ({ currentUser, onUserChange, currentData }: { 
  currentUser: string, 
  onUserChange: (userId: string) => void,
  currentData: any
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Use current data for the active user, fallback to static data for others
  const getCurrentProfile = (userId: string) => {
    if (userId === currentUser) {
      return currentData;
    }
    return designerProfiles[userId as keyof typeof designerProfiles];
  };

  const currentProfile = getCurrentProfile(currentUser);

  return (
    <div className="relative mb-6" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Image
            src={currentProfile.profileImage}
            alt={currentProfile.name}
            width={32}
            height={32}
            className="rounded-full object-cover"
          />
          <div className="text-left">
            <p className="font-medium text-gray-900">{currentProfile.name}</p>
            <p className="text-sm text-gray-500">{currentProfile.title}</p>
          </div>
        </div>
        <FaChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {Object.entries(designerProfiles).map(([key, profile]) => {
            const displayProfile = getCurrentProfile(key);
            return (
              <button
                key={key}
                onClick={() => {
                  onUserChange(key);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                  key === currentUser ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
                <Image
                  src={displayProfile.profileImage}
                  alt={displayProfile.name}
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{displayProfile.name}</p>
                  <p className="text-sm text-gray-500">{displayProfile.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Enhanced SMS Modal
const SMSModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle message sending logic here
    console.log('Message sent:', message);
    setMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Send Message</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi Sarah, I'm interested in discussing a project..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              Send Message
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// Enhanced Team Section Component with Full Editing
const TeamSection = ({ data, isEditing, onEdit }: { 
  data: any, 
  isEditing: boolean, 
  onEdit: (data: any) => void 
}) => {
  const [editingMember, setEditingMember] = useState<number | null>(null);
  const [newMember, setNewMember] = useState({
    name: '',
    role: '',
    bio: '',
    email: '',
    image: 'https://source.unsplash.com/random/200x200?designer,team,placeholder'
  });

  const handleAddMember = () => {
    if (newMember.name && newMember.role) {
      const updatedTeam = [...(data.team || []), {
        id: Date.now(),
        ...newMember
      }];
      onEdit({ ...data, team: updatedTeam });
      setNewMember({
        name: '',
        role: '',
        bio: '',
        email: '',
        image: 'https://source.unsplash.com/random/200x200?designer,team,placeholder'
      });
    }
  };

  const handleEditMember = (memberId: number, updatedMember: any) => {
    const updatedTeam = data.team.map((member: any) => 
      member.id === memberId ? { ...member, ...updatedMember } : member
    );
    onEdit({ ...data, team: updatedTeam });
    setEditingMember(null);
  };

  const handleDeleteMember = (memberId: number) => {
    const updatedTeam = data.team.filter((member: any) => member.id !== memberId);
    onEdit({ ...data, team: updatedTeam });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Meet Our Team</h3>
          {isEditing && (
            <button
              onClick={() => setEditingMember(-1)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <FaPlus className="w-4 h-4" />
              Add Member
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.team?.map((member: any, index: number) => (
            <motion.div 
              key={member.id} 
              className="relative group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {editingMember === member.id ? (
                <div className="bg-gray-50 p-4 rounded-xl">
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => handleEditMember(member.id, { name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-bold"
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={member.role}
                      onChange={(e) => handleEditMember(member.id, { role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-gray-600"
                      placeholder="Role"
                    />
                    <textarea
                      value={member.bio}
                      onChange={(e) => handleEditMember(member.id, { bio: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-gray-500 text-xs"
                      placeholder="Bio"
                      rows={2}
                    />
                    <input
                      type="email"
                      value={member.email}
                      onChange={(e) => handleEditMember(member.id, { email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-gray-500 text-xs"
                      placeholder="Email"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingMember(null)}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMember(null)}
                        className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 overflow-hidden">
                    <Image
                      src={member.image}
                      alt={member.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h4 className="font-bold text-gray-900">{member.name}</h4>
                  <p className="text-gray-600 text-sm">{member.role}</p>
                  <p className="text-gray-500 text-xs mt-2">{member.bio}</p>
                  {member.email && (
                    <p className="text-blue-600 text-xs mt-1">
                      <a href={`mailto:${member.email}`}>{member.email}</a>
                    </p>
                  )}
                  
                  {isEditing && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={() => setEditingMember(member.id)}
                        className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FaEdit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <FaTrash className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}

          {/* Add New Member Form */}
          {isEditing && editingMember === -1 && (
            <motion.div 
              className="bg-blue-50 p-4 rounded-xl border-2 border-dashed border-blue-300"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="space-y-3">
                <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <FaUser className="w-8 h-8 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                  placeholder="Name"
                />
                <input
                  type="text"
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                  placeholder="Role"
                />
                <textarea
                  value={newMember.bio}
                  onChange={(e) => setNewMember({ ...newMember, bio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-xs"
                  placeholder="Bio"
                  rows={2}
                />
                <input
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-xs"
                  placeholder="Email"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddMember}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setEditingMember(null)}
                    className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

// Fibonacci Project Grid
const FibonacciProjectGrid = ({ projects, isEditing, onEdit, onAddProject }: { 
  projects: any[], 
  isEditing: boolean, 
  onEdit: (projects: any[]) => void,
  onAddProject: () => void
}) => {
  const getSpanClass = (index: number) => {
    const fibonacci = [1, 1, 2, 3, 5, 8];
    const spanValue = fibonacci[index % fibonacci.length];
    
    if (spanValue >= 5) return 'col-span-2 row-span-2';
    if (spanValue >= 3) return 'col-span-2 row-span-1';
    if (spanValue >= 2) return 'col-span-1 row-span-2';
    return 'col-span-1 row-span-1';
  };

  return (
    <motion.div 
      className="grid grid-cols-3 gap-4 auto-rows-[200px]"
      initial="hidden"
      animate="visible"
    >
      {projects.map((project, index) => (
        <motion.div
          key={project.id}
          custom={index}
          variants={spiralVariants}
          className={`${getSpanClass(index)} relative group overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer`}
        >
          <Image
            src={project.image}
            alt={project.title}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h3 className="font-bold text-lg mb-1">{project.title}</h3>
            <p className="text-sm opacity-90">{project.category} • {project.year}</p>
          </div>
          {isEditing && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors">
                <FaEdit className="w-3 h-3" />
              </button>
              <button className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-colors">
                <FaTrash className="w-3 h-3" />
              </button>
            </div>
          )}
        </motion.div>
      ))}
      {isEditing && (
        <motion.div
          onClick={onAddProject}
          className="col-span-1 row-span-1 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
          whileHover={{ scale: 1.05 }}
        >
          <div className="text-center text-gray-500">
            <FaPlus className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Add Project</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

// About Section
const AboutSection = ({ data, isEditing, onEdit }: { 
  data: any, 
  isEditing: boolean, 
  onEdit: (data: any) => void 
}) => (
  <div className="space-y-8">
    {/* Bio */}
    <motion.div 
      className="bg-white rounded-2xl p-8 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="text-xl font-bold text-gray-900 mb-4">About Me</h3>
      {isEditing ? (
        <textarea
          value={data.bio}
          onChange={(e) => onEdit({ ...data, bio: e.target.value })}
          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={4}
        />
      ) : (
        <p className="text-gray-700 leading-relaxed">{data.bio}</p>
      )}
    </motion.div>

    {/* Specialties */}
    <motion.div 
      className="bg-white rounded-2xl p-8 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <h3 className="text-xl font-bold text-gray-900 mb-6">Specialties</h3>
      <div className="grid grid-cols-2 gap-4">
        {data.specialties.map((specialty: string, index: number) => (
          <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <div className="w-2 h-2 bg-blue-600 rounded-full" />
            <span className="text-gray-700 font-medium">{specialty}</span>
          </div>
        ))}
      </div>
    </motion.div>

    {/* Awards & Recognition */}
    <motion.div 
      className="bg-white rounded-2xl p-8 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h3 className="text-xl font-bold text-gray-900 mb-6">Awards & Recognition</h3>
      <div className="grid grid-cols-2 gap-4">
        {data.badges.map((badge: any, index: number) => (
          <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
            <span className="text-2xl">{badge.icon}</span>
            <div>
              <p className="font-medium text-gray-900">{badge.name}</p>
              <p className="text-sm text-gray-600 capitalize">{badge.type}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  </div>
);

// Services Section
const ServicesSection = ({ services, isEditing, onEdit }: { 
  services: any[], 
  isEditing: boolean, 
  onEdit: (services: any[]) => void 
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {services.map((service, index) => (
      <motion.div
        key={index}
        className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <h3 className="text-xl font-bold text-gray-900 mb-2">{service.name}</h3>
        <p className="text-2xl font-bold text-blue-600 mb-4">{service.price}</p>
        <p className="text-gray-700">{service.description}</p>
        <button className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium">
          Learn More
        </button>
      </motion.div>
    ))}
  </div>
);

// Process Section
const ProcessSection = ({ process }: { process: any[] }) => (
  <div className="space-y-6">
    {process.map((step, index) => (
      <motion.div
        key={step.step}
        className="bg-white rounded-2xl p-8 shadow-lg"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
            {step.step}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
            <p className="text-gray-700">{step.description}</p>
          </div>
        </div>
      </motion.div>
    ))}
  </div>
);

// Testimonials Section
const TestimonialsSection = ({ testimonials }: { testimonials: any[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {testimonials.map((testimonial, index) => (
      <motion.div
        key={testimonial.id}
        className="bg-white rounded-2xl p-8 shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <div className="flex items-center gap-4 mb-4">
          <Image
            src={testimonial.image}
            alt={testimonial.name}
            width={50}
            height={50}
            className="rounded-full object-cover"
          />
          <div>
            <h4 className="font-bold text-gray-900">{testimonial.name}</h4>
            <p className="text-sm text-gray-600">{testimonial.project}</p>
          </div>
        </div>
        <div className="flex mb-4">
          {[...Array(testimonial.rating)].map((_, i) => (
            <FaStar key={i} className="w-4 h-4 text-yellow-400" />
          ))}
        </div>
        <p className="text-gray-700 italic">"{testimonial.text}"</p>
      </motion.div>
    ))}
  </div>
);

// Enhanced Video Section with Channel Features
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
          projects={designerProfiles['sarah-chen'].featuredProjects || []}
        />
      )}
    </div>
  );
};

// Feed Section Component
const FeedSection = () => (
  <div className="space-y-6">
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <FaImages className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-gray-900 font-medium">Added new project photos</p>
            <p className="text-gray-600 text-sm">Modern Coastal Retreat - 3 hours ago</p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <FaAward className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-gray-900 font-medium">Featured in Architectural Digest</p>
            <p className="text-gray-600 text-sm">Sustainable Family Home project - 2 days ago</p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <FaVideo className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-gray-900 font-medium">Uploaded design process video</p>
            <p className="text-gray-600 text-sm">Behind the scenes content - 1 week ago</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function DesignerProfile() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [direction, setDirection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('sarah-chen');
  const [designerData, setDesignerData] = useState(designerProfiles['sarah-chen']);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // Project creation modal state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const { scrollY } = useScroll();
  const sidebarY = useTransform(scrollY, [0, 1000], [0, -100]);

  // Load saved data from localStorage on component mount
  useEffect(() => {
    const loadUserData = () => {
      const savedUserId = localStorage.getItem('currentDesignerProfile') || 'sarah-chen';
      const savedDataKey = `designerProfile_${savedUserId}`;
      const savedData = localStorage.getItem(savedDataKey);
      
      console.log('Loading data for user:', savedUserId);
      console.log('Saved data exists:', !!savedData);
      
      setCurrentUserId(savedUserId);
      
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          console.log('Parsed saved data:', parsedData);
          setDesignerData(parsedData);
        } catch (error) {
          console.error('Error parsing saved data:', error);
          const fallbackData = designerProfiles[savedUserId as keyof typeof designerProfiles] || designerProfiles['sarah-chen'];
          setDesignerData(fallbackData);
          localStorage.setItem(savedDataKey, JSON.stringify(fallbackData));
        }
      } else {
        const defaultData = designerProfiles[savedUserId as keyof typeof designerProfiles] || designerProfiles['sarah-chen'];
        setDesignerData(defaultData);
        localStorage.setItem(savedDataKey, JSON.stringify(defaultData));
        console.log('No saved data, using default:', defaultData);
      }
      
      setIsDataLoaded(true);
    };

    loadUserData();
  }, []);

  // Save data whenever it changes (but only after initial load)
  useEffect(() => {
    if (isDataLoaded && currentUserId) {
      const dataKey = `designerProfile_${currentUserId}`;
      localStorage.setItem(dataKey, JSON.stringify(designerData));
      console.log('Data auto-saved for:', currentUserId, designerData);
    }
  }, [designerData, currentUserId, isDataLoaded]);

  const handleUserChange = (userId: string) => {
    console.log('Switching user from', currentUserId, 'to', userId);
    
    // Save current user data before switching
    if (currentUserId) {
      const currentDataKey = `designerProfile_${currentUserId}`;
      localStorage.setItem(currentDataKey, JSON.stringify(designerData));
      console.log('Saved current user data before switch:', designerData);
    }
    
    // Update the current user preference
    localStorage.setItem('currentDesignerProfile', userId);
    
    // Load new user data
    const newDataKey = `designerProfile_${userId}`;
    const savedData = localStorage.getItem(newDataKey);
    
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setDesignerData(parsedData);
        console.log('Loaded existing data for new user:', parsedData);
      } catch (error) {
        console.error('Error parsing saved data for new user:', error);
        const fallbackData = designerProfiles[userId as keyof typeof designerProfiles];
        setDesignerData(fallbackData);
        localStorage.setItem(newDataKey, JSON.stringify(fallbackData));
      }
    } else {
      const defaultData = designerProfiles[userId as keyof typeof designerProfiles];
      setDesignerData(defaultData);
      localStorage.setItem(newDataKey, JSON.stringify(defaultData));
      console.log('No existing data for new user, using default:', defaultData);
    }
    
    setCurrentUserId(userId);
    setIsEditing(false);
  };

  const tabs = [
    { id: 'feed' as TabType, label: 'Feed', icon: FaNewspaper },
    { id: 'projects' as TabType, label: 'Projects', icon: FaTh },
    { id: 'videos' as TabType, label: 'Videos', icon: FaVideo },
    { id: 'team' as TabType, label: 'Team', icon: FaUsers },
    { id: 'about' as TabType, label: 'About', icon: FaUser },
  ];

  const handleTabChange = (newTab: TabType) => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    const newIndex = tabs.findIndex(tab => tab.id === newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
  };

  const handleSave = () => {
    // Force save the current data
    const dataKey = `designerProfile_${currentUserId}`;
    localStorage.setItem(dataKey, JSON.stringify(designerData));
    setIsEditing(false);
    console.log('Manual save completed for:', currentUserId, designerData);
    
    // Show a brief success message
    alert('Profile saved successfully!');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'feed':
        return <FeedSection />;
      case 'projects':
        return (
          <>
            <FibonacciProjectGrid 
              projects={designerData.featuredProjects}
              isEditing={isEditing}
              onEdit={(projects) => setDesignerData({ ...designerData, featuredProjects: projects })}
              onAddProject={() => setIsProjectModalOpen(true)}
            />
            {/* Project Creation Modal */}
            <ProjectCreationModal
              isOpen={isProjectModalOpen}
              onClose={() => setIsProjectModalOpen(false)}
              onProjectCreated={(newProject) => {
                // Convert the project data to match the featuredProjects format
                const projectForGrid = {
                  id: newProject.id,
                  title: newProject.name,
                  image: newProject.images?.[0]?.url || 'https://source.unsplash.com/random/600x400?interior',
                  link: `/project/${newProject.id}`,
                  category: newProject.category || 'Residential',
                  size: 'medium',
                  year: new Date().getFullYear().toString(),
                  description: newProject.description
                };
                
                // Add the new project to the featured projects
                const updatedProjects = [...designerData.featuredProjects, projectForGrid];
                setDesignerData({ ...designerData, featuredProjects: updatedProjects });
                
                // Close the modal
                setIsProjectModalOpen(false);
                
                // Show success message
                alert('Project created successfully!');
              }}
            />
          </>
        );
      case 'videos':
        return <VideoSection />;
      case 'team':
        return <TeamSection data={designerData} isEditing={isEditing} onEdit={setDesignerData} />;
      case 'about':
        return (
          <AboutSection 
            data={designerData}
            isEditing={isEditing}
            onEdit={setDesignerData}
          />
        );
      default:
        return <FeedSection />;
    }
  };

  // Don't render until data is loaded
  if (!isDataLoaded) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

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
                {/* Edit Button for Designers */}
                {role === 'designer' && (
                  <div className="flex justify-end mb-4">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-colors"
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
                )}

                {/* User Switcher */}
                <UserSwitcher 
                  currentUser={currentUserId} 
                  onUserChange={handleUserChange} 
                  currentData={designerData}
                />

                {/* Profile Image */}
                <ProfilePhotoUpload
                  currentImage={designerData.profileImage}
                  onImageChange={(imageUrl) => setDesignerData({ ...designerData, profileImage: imageUrl })}
                  isEditing={isEditing}
                />

                {/* Name & Title */}
                <div className="text-center mb-6">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={designerData.name}
                        onChange={(e) => setDesignerData({ ...designerData, name: e.target.value })}
                        className="w-full text-center text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-1"
                      />
                      <input
                        value={designerData.title}
                        onChange={(e) => setDesignerData({ ...designerData, title: e.target.value })}
                        className="w-full text-center text-gray-600 border border-gray-300 rounded-lg px-3 py-1"
                      />
                      <input
                        value={designerData.location}
                        onChange={(e) => setDesignerData({ ...designerData, location: e.target.value })}
                        className="w-full text-center text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1"
                      />
                    </div>
                  ) : (
                    <>
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">{designerData.name}</h1>
                      <p className="text-gray-600 mb-1">{designerData.title}</p>
                      <p className="text-gray-500 text-sm">{designerData.location}</p>
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
                {role !== 'designer' && (
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
                )}

                {/* Contact Info */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3">
                    <FaEnvelope className="w-4 h-4 text-blue-600" />
                    {isEditing ? (
                      <input
                        type="email"
                        value={designerData.contact.email}
                        onChange={(e) => setDesignerData({ 
                          ...designerData, 
                          contact: { ...designerData.contact, email: e.target.value }
                        })}
                        className="flex-1 text-sm text-gray-700 border border-gray-300 rounded-lg px-2 py-1"
                        placeholder="Email"
                      />
                    ) : (
                      <a href={`mailto:${designerData.contact.email}`} className="text-gray-700 hover:text-blue-600 transition-colors text-sm">
                        {designerData.contact.email}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <FaPhone className="w-4 h-4 text-blue-600" />
                    {isEditing ? (
                      <input
                        type="tel"
                        value={designerData.contact.phone}
                        onChange={(e) => setDesignerData({ 
                          ...designerData, 
                          contact: { ...designerData.contact, phone: e.target.value }
                        })}
                        className="flex-1 text-sm text-gray-700 border border-gray-300 rounded-lg px-2 py-1"
                        placeholder="Phone"
                      />
                    ) : (
                      <a href={`tel:${designerData.contact.phone}`} className="text-gray-700 hover:text-blue-600 transition-colors text-sm">
                        {designerData.contact.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Social Links */}
                <div className="space-y-3 mb-6">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <FaInstagram className="w-4 h-4 text-pink-600" />
                        <input
                          type="url"
                          value={designerData.social.instagram}
                          onChange={(e) => setDesignerData({ 
                            ...designerData, 
                            social: { ...designerData.social, instagram: e.target.value }
                          })}
                          className="flex-1 text-sm text-gray-700 border border-gray-300 rounded-lg px-2 py-1"
                          placeholder="Instagram URL"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <FaGlobe className="w-4 h-4 text-blue-600" />
                        <input
                          type="url"
                          value={designerData.social.website}
                          onChange={(e) => setDesignerData({ 
                            ...designerData, 
                            social: { ...designerData.social, website: e.target.value }
                          })}
                          className="flex-1 text-sm text-gray-700 border border-gray-300 rounded-lg px-2 py-1"
                          placeholder="Website URL"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 justify-center">
                      <a href={designerData.social.instagram} target="_blank" rel="noopener noreferrer">
                        <FaInstagram className="w-6 h-6 text-gray-600 hover:text-pink-600 transition-colors" />
                      </a>
                      <a href={designerData.social.website} target="_blank" rel="noopener noreferrer">
                        <FaGlobe className="w-6 h-6 text-gray-600 hover:text-blue-600 transition-colors" />
                      </a>
                    </div>
                  )}
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