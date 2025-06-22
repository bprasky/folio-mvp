'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaChalkboardTeacher, FaClock, FaUsers, FaStar, FaPlay, FaCheck, FaLock, FaBookmark, FaFilter, FaSearch } from 'react-icons/fa';
import Navigation from '../../../components/Navigation';
import { useRole } from '../../../contexts/RoleContext';

// Mock muscle classes data
const muscleClasses = [
  {
    id: 1,
    title: 'Color Psychology in Residential Spaces',
    instructor: 'David Kim',
    instructorTitle: 'Senior Designer at Studio Verde',
    instructorAvatar: 'DK',
    description: 'Learn how color choices affect mood and behavior in home environments through real project breakdowns.',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    duration: '45 min',
    difficulty: 'Beginner',
    enrolled: 234,
    rating: 4.8,
    price: 'Free',
    category: 'Color Theory',
    tags: ['Color', 'Psychology', 'Residential'],
    completed: false,
    inProgress: false,
    nextSession: 'Tomorrow 2:00 PM',
    modules: [
      { title: 'Introduction to Color Psychology', duration: '8 min', completed: false },
      { title: 'Warm vs Cool Colors in Living Spaces', duration: '12 min', completed: false },
      { title: 'Case Study: Calming Bedroom Design', duration: '15 min', completed: false },
      { title: 'Practical Application Exercise', duration: '10 min', completed: false }
    ]
  },
  {
    id: 2,
    title: 'Space Planning Fundamentals',
    instructor: 'Sarah Martinez',
    instructorTitle: 'Principal at Martinez Design Co.',
    instructorAvatar: 'SM',
    description: 'Master efficient space planning with real-world examples and hands-on exercises from actual client projects.',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    duration: '60 min',
    difficulty: 'Intermediate',
    enrolled: 189,
    rating: 4.9,
    price: '$15',
    category: 'Space Planning',
    tags: ['Layout', 'Planning', 'Efficiency'],
    completed: false,
    inProgress: true,
    progress: 65,
    nextSession: 'Friday 10:00 AM',
    modules: [
      { title: 'Understanding Traffic Flow', duration: '15 min', completed: true },
      { title: 'Furniture Placement Strategies', duration: '20 min', completed: true },
      { title: 'Small Space Solutions', duration: '15 min', completed: false },
      { title: 'Client Project Walkthrough', duration: '10 min', completed: false }
    ]
  },
  {
    id: 3,
    title: 'Sustainable Material Selection',
    instructor: 'Emma Green',
    instructorTitle: 'Sustainable Design Consultant',
    instructorAvatar: 'EG',
    description: 'Learn to choose eco-friendly materials without compromising on style or budget through real project examples.',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    duration: '50 min',
    difficulty: 'Intermediate',
    enrolled: 156,
    rating: 4.7,
    price: '$20',
    category: 'Sustainability',
    tags: ['Sustainable', 'Materials', 'Eco-friendly'],
    completed: true,
    inProgress: false,
    nextSession: 'Next Week',
    modules: [
      { title: 'Introduction to Sustainable Design', duration: '10 min', completed: true },
      { title: 'Material Lifecycle Analysis', duration: '15 min', completed: true },
      { title: 'Budget-Friendly Sustainable Options', duration: '15 min', completed: true },
      { title: 'Real Project Case Studies', duration: '10 min', completed: true }
    ]
  },
  {
    id: 4,
    title: 'Lighting Design Principles',
    instructor: 'Michael Chen',
    instructorTitle: 'Lighting Designer at Lumina Studio',
    instructorAvatar: 'MC',
    description: 'Master the art of lighting design through analysis of award-winning residential projects.',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    duration: '55 min',
    difficulty: 'Advanced',
    enrolled: 98,
    rating: 4.9,
    price: '$25',
    category: 'Lighting',
    tags: ['Lighting', 'Ambiance', 'Technical'],
    completed: false,
    inProgress: false,
    locked: true,
    requirement: 'Complete Space Planning Fundamentals',
    nextSession: 'Available after prerequisite',
    modules: [
      { title: 'Types of Lighting', duration: '12 min', completed: false },
      { title: 'Layering Light Techniques', duration: '18 min', completed: false },
      { title: 'Smart Lighting Integration', duration: '15 min', completed: false },
      { title: 'Award-Winning Project Analysis', duration: '10 min', completed: false }
    ]
  },
  {
    id: 5,
    title: 'Client Communication Masterclass',
    instructor: 'Lisa Park',
    instructorTitle: 'Design Studio Owner & Business Coach',
    instructorAvatar: 'LP',
    description: 'Learn professional communication skills through real client interaction scenarios and best practices.',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    duration: '40 min',
    difficulty: 'Beginner',
    enrolled: 312,
    rating: 4.8,
    price: 'Free',
    category: 'Business Skills',
    tags: ['Communication', 'Client Relations', 'Professional'],
    completed: false,
    inProgress: false,
    nextSession: 'Monday 3:00 PM',
    modules: [
      { title: 'First Client Meeting Best Practices', duration: '10 min', completed: false },
      { title: 'Presenting Design Concepts', duration: '12 min', completed: false },
      { title: 'Handling Client Feedback', duration: '10 min', completed: false },
      { title: 'Project Timeline Communication', duration: '8 min', completed: false }
    ]
  },
  {
    id: 6,
    title: 'Budget Management for Designers',
    instructor: 'Robert Davis',
    instructorTitle: 'Senior Project Manager at Davis Interiors',
    instructorAvatar: 'RD',
    description: 'Master project budgeting and cost management through real project breakdowns and industry insights.',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    duration: '65 min',
    difficulty: 'Intermediate',
    enrolled: 145,
    rating: 4.6,
    price: '$18',
    category: 'Business Skills',
    tags: ['Budget', 'Project Management', 'Cost Control'],
    completed: false,
    inProgress: false,
    nextSession: 'Wednesday 1:00 PM',
    modules: [
      { title: 'Creating Accurate Estimates', duration: '20 min', completed: false },
      { title: 'Managing Cost Overruns', duration: '15 min', completed: false },
      { title: 'Client Budget Conversations', duration: '20 min', completed: false },
      { title: 'Real Project Budget Analysis', duration: '10 min', completed: false }
    ]
  }
];

export default function StudentClasses() {
  const { role } = useRole();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredClasses, setFilteredClasses] = useState(muscleClasses);

  // Redirect if not student
  useEffect(() => {
    if (role && role !== 'student') {
      window.location.href = '/';
    }
  }, [role]);

  useEffect(() => {
    let filtered = muscleClasses;

    // Apply category filter
    if (filter !== 'all') {
      if (filter === 'in_progress') {
        filtered = filtered.filter(cls => cls.inProgress);
      } else if (filter === 'completed') {
        filtered = filtered.filter(cls => cls.completed);
      } else if (filter === 'free') {
        filtered = filtered.filter(cls => cls.price === 'Free');
      } else {
        filtered = filtered.filter(cls => cls.category.toLowerCase() === filter);
      }
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(cls => 
        cls.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredClasses(filtered);
  }, [filter, searchTerm]);

  if (role !== 'student') {
    return <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
        <p className="text-gray-600">This page is only available for students.</p>
      </div>
    </div>;
  }

  const filterOptions = [
    { value: 'all', label: 'All Classes' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'free', label: 'Free' },
    { value: 'color theory', label: 'Color Theory' },
    { value: 'space planning', label: 'Space Planning' },
    { value: 'sustainability', label: 'Sustainability' },
    { value: 'lighting', label: 'Lighting' },
    { value: 'business skills', label: 'Business Skills' }
  ];

  const getStatusBadge = (cls: any) => {
    if (cls.locked) {
      return (
        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
          <FaLock className="w-3 h-3" />
          Locked
        </span>
      );
    }
    if (cls.completed) {
      return (
        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
          <FaCheck className="w-3 h-3" />
          Completed
        </span>
      );
    }
    if (cls.inProgress) {
      return (
        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
          {cls.progress}% Complete
        </span>
      );
    }
    return (
      <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
        Not Started
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-primary flex">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Muscle Classes</h1>
            <p className="text-gray-600">Learn from real projects and industry professionals through hands-on tutorials</p>
          </motion.div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            {/* Search Bar */}
            <div className="relative mb-6">
              <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search classes, instructors, or topics..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 mb-4">
              <FaFilter className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter by:</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    filter === option.value
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Classes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.map((cls, index) => (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all ${
                  cls.locked ? 'opacity-75' : ''
                }`}
              >
                {/* Class Image */}
                <div className="relative h-48">
                  <img src={cls.image} alt={cls.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                    {cls.locked ? (
                      <div className="text-white text-center">
                        <FaLock className="text-2xl mb-2 mx-auto" />
                        <div className="text-sm">Complete prerequisite</div>
                      </div>
                    ) : cls.completed ? (
                      <div className="text-white text-center">
                        <FaCheck className="text-2xl mb-2 mx-auto" />
                        <div className="text-sm">Completed</div>
                      </div>
                    ) : (
                      <div className="text-white text-center">
                        <FaPlay className="text-2xl mb-2 mx-auto" />
                        <div className="text-sm">Start Learning</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Price Badge */}
                  <div className="absolute top-4 right-4">
                    {cls.price === 'Free' ? (
                      <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Free
                      </span>
                    ) : (
                      <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        {cls.price}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar for In Progress Classes */}
                  {cls.inProgress && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-20">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${cls.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Class Info */}
                <div className="p-6">
                  {/* Status Badge */}
                  <div className="mb-3">
                    {getStatusBadge(cls)}
                  </div>

                  {/* Title and Description */}
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{cls.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{cls.description}</p>

                  {/* Instructor */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {cls.instructorAvatar}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{cls.instructor}</div>
                      <div className="text-xs text-gray-500">{cls.instructorTitle}</div>
                    </div>
                  </div>

                  {/* Class Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-500">Duration</div>
                      <div className="font-medium text-gray-900 text-sm">{cls.duration}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-500">Level</div>
                      <div className="font-medium text-gray-900 text-sm">{cls.difficulty}</div>
                    </div>
                  </div>

                  {/* Rating and Enrollment */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <FaStar className="text-yellow-500 w-4 h-4" />
                      <span className="text-sm font-medium text-gray-900">{cls.rating}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <FaUsers className="w-4 h-4" />
                      {cls.enrolled}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {cls.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {cls.locked ? (
                      <button disabled className="w-full bg-gray-200 text-gray-500 py-2 rounded-lg font-medium cursor-not-allowed">
                        {cls.requirement}
                      </button>
                    ) : cls.completed ? (
                      <button className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
                        Review Class
                      </button>
                    ) : cls.inProgress ? (
                      <button className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                        Continue Learning
                      </button>
                    ) : (
                      <button className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                        Start Class
                      </button>
                    )}
                    
                    <div className="flex gap-2">
                      <button className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:border-blue-300 hover:text-blue-600 transition-colors text-sm">
                        Preview
                      </button>
                      <button className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:border-yellow-300 hover:text-yellow-600 transition-colors">
                        <FaBookmark className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Next Session */}
                  {!cls.locked && (
                    <div className="mt-3 text-center">
                      <div className="text-xs text-gray-500">Next session: {cls.nextSession}</div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Empty State */}
          {filteredClasses.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="text-gray-400 mb-4">
                <FaChalkboardTeacher className="text-6xl mx-auto mb-4" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No classes found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your search or filter criteria</p>
              <button 
                onClick={() => {
                  setFilter('all');
                  setSearchTerm('');
                }}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
} 