'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaGraduationCap, FaChalkboardTeacher, FaUserGraduate, FaStar, FaPlus, FaHeart, FaComment, FaShare, FaBookmark, FaTrophy, FaClock, FaFilter } from 'react-icons/fa';
import { useRole } from '../../../contexts/RoleContext';

// Mock explore feed data
const exploreFeed = [
  {
    id: 1,
    type: 'student_spotlight',
    author: 'Emma Rodriguez',
    school: 'RISD',
    graduationYear: 2025,
    title: 'Biophilic Apartment Redesign',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    description: 'A sustainable approach to small space living using natural materials and plants to create a calming urban oasis.',
    likes: 89,
    comments: 12,
    timeAgo: '2 hours ago',
    tags: ['Sustainable', 'Small Space', 'Biophilic'],
    featured: true
  },
  {
    id: 2,
    type: 'muscle_class',
    instructor: 'David Kim',
    instructorTitle: 'Senior Designer at Studio Verde',
    title: 'Color Psychology in Residential Spaces',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    description: 'Learn how color choices affect mood and behavior in home environments. This hands-on class includes real project examples.',
    duration: '45 min',
    difficulty: 'Beginner',
    enrolled: 234,
    rating: 4.8,
    price: 'Free',
    nextSession: 'Tomorrow 2:00 PM'
  },
  {
    id: 3,
    type: 'collaboration',
    author: 'Maya Patel',
    school: 'Art Center',
    graduationYear: 2024,
    title: 'Looking for partner: Modern Kitchen Design Challenge',
    description: 'Seeking a student interested in sustainable materials for a collaborative project. This is for a real client with a $15k budget.',
    timeAgo: '1 day ago',
    responses: 8,
    skills: ['3D Modeling', 'Sustainable Design', 'Kitchen Design'],
    deadline: '1 week'
  },
  {
    id: 4,
    type: 'internship',
    company: 'Studio Verde',
    companyLogo: 'SV',
    title: 'Summer Design Intern',
    location: 'San Francisco, CA',
    description: 'Join our team for hands-on experience in sustainable residential design. Work directly with senior designers on real projects.',
    deadline: '2 weeks',
    applicants: 45,
    type_detail: 'Paid Internship',
    duration: '3 months',
    requirements: ['Portfolio', 'Junior/Senior level', 'AutoCAD experience']
  },
  {
    id: 5,
    type: 'student_spotlight',
    author: 'James Wilson',
    school: 'Parsons',
    graduationYear: 2026,
    title: 'Adaptive Reuse: Converting Warehouse to Loft',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    description: 'Transforming industrial spaces into livable environments while preserving historical character.',
    likes: 156,
    comments: 23,
    timeAgo: '1 day ago',
    tags: ['Adaptive Reuse', 'Industrial', 'Loft Design'],
    featured: false
  },
  {
    id: 6,
    type: 'muscle_class',
    instructor: 'Sarah Martinez',
    instructorTitle: 'Principal at Martinez Design Co.',
    title: 'Space Planning Fundamentals',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    description: 'Master the art of efficient space planning with real-world examples and hands-on exercises.',
    duration: '60 min',
    difficulty: 'Intermediate',
    enrolled: 189,
    rating: 4.9,
    price: '$15',
    nextSession: 'Friday 10:00 AM'
  }
];

export default function StudentExplore() {
  const { role } = useRole();
  const [filter, setFilter] = useState('all');
  const [filteredFeed, setFilteredFeed] = useState(exploreFeed);

  // Redirect if not student
  useEffect(() => {
    if (role && role !== 'student') {
      window.location.href = '/';
    }
  }, [role]);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredFeed(exploreFeed);
    } else {
      setFilteredFeed(exploreFeed.filter(item => item.type === filter));
    }
  }, [filter]);

  if (role !== 'student') {
    return <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
        <p className="text-gray-600">This page is only available for students.</p>
      </div>
    </div>;
  }

  const filterOptions = [
    { value: 'all', label: 'All', count: exploreFeed.length },
    { value: 'student_spotlight', label: 'Student Work', count: exploreFeed.filter(item => item.type === 'student_spotlight').length },
    { value: 'muscle_class', label: 'Classes', count: exploreFeed.filter(item => item.type === 'muscle_class').length },
    { value: 'collaboration', label: 'Collaborations', count: exploreFeed.filter(item => item.type === 'collaboration').length },
    { value: 'internship', label: 'Internships', count: exploreFeed.filter(item => item.type === 'internship').length }
  ];

  return (
    <div className="min-h-screen bg-primary flex">
      
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Explore</h1>
            <p className="text-gray-600">Discover student work, classes, collaborations, and opportunities</p>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
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
                  {option.label} ({option.count})
                </button>
              ))}
            </div>
          </motion.div>

          {/* Feed */}
          <div className="space-y-6">
            {filteredFeed.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                {item.type === 'student_spotlight' && (
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {item.author?.[0] || 'S'}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{item.author}</div>
                        <div className="text-sm text-gray-500">{item.school} • Class of {item.graduationYear} • {item.timeAgo}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.featured && (
                          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                            <FaStar className="w-3 h-3" />
                            Featured
                          </span>
                        )}
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                          Student Work
                        </span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-gray-600 mb-4">{item.description}</p>
                    
                    <div className="relative h-64 rounded-lg overflow-hidden mb-4">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {item.tags?.map((tag) => (
                        <span key={tag} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <button className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors">
                        <FaHeart /> {item.likes}
                      </button>
                      <button className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors">
                        <FaComment /> {item.comments}
                      </button>
                      <button className="flex items-center gap-2 text-gray-600 hover:text-green-500 transition-colors">
                        <FaShare /> Share
                      </button>
                      <button className="flex items-center gap-2 text-gray-600 hover:text-yellow-500 transition-colors ml-auto">
                        <FaBookmark /> Save
                      </button>
                    </div>
                  </div>
                )}

                {item.type === 'muscle_class' && (
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white">
                        <FaChalkboardTeacher />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{item.instructor}</div>
                        <div className="text-sm text-gray-500">{item.instructorTitle}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                          Muscle Class
                        </span>
                        {item.price === 'Free' ? (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                            Free
                          </span>
                        ) : (
                          <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                            {item.price}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-gray-600 mb-4">{item.description}</p>
                    
                    <div className="relative h-48 rounded-lg overflow-hidden mb-4">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                        <div className="text-white text-center">
                          <div className="text-2xl mb-2">▶️</div>
                          <div className="font-medium">Preview Class</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-sm text-gray-500">Duration</div>
                        <div className="font-medium text-gray-900">{item.duration}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-500">Level</div>
                        <div className="font-medium text-gray-900">{item.difficulty}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-500">Enrolled</div>
                        <div className="font-medium text-gray-900">{item.enrolled}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-500">Rating</div>
                        <div className="font-medium text-gray-900">⭐ {item.rating}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                        Enroll Now
                      </button>
                      <div className="text-sm text-gray-600">
                        Next: {item.nextSession}
                      </div>
                    </div>
                  </div>
                )}

                {item.type === 'collaboration' && (
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {item.author?.[0] || 'C'}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{item.author}</div>
                        <div className="text-sm text-gray-500">{item.school} • Class of {item.graduationYear} • {item.timeAgo}</div>
                      </div>
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                        Collaboration
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-gray-600 mb-4">{item.description}</p>
                    
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Skills needed:</div>
                      <div className="flex flex-wrap gap-2">
                        {item.skills?.map((skill) => (
                          <span key={skill} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
                        Apply to Collaborate
                      </button>
                      <span className="text-sm text-gray-600">{item.responses} responses</span>
                      <span className="text-sm text-gray-600">Deadline: {item.deadline}</span>
                    </div>
                  </div>
                )}

                {item.type === 'internship' && (
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {item.companyLogo}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{item.company}</div>
                        <div className="text-sm text-gray-500">{item.location}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                          {item.type_detail}
                        </span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-gray-600 mb-4">{item.description}</p>
                    
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Requirements:</div>
                      <div className="flex flex-wrap gap-2">
                        {item.requirements?.map((req) => (
                          <span key={req} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                            {req}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-500">Duration</div>
                        <div className="font-medium text-gray-900">{item.duration}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Deadline</div>
                        <div className="font-medium text-gray-900">{item.deadline}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Applicants</div>
                        <div className="font-medium text-gray-900">{item.applicants}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors">
                        Apply Now
                      </button>
                      <button className="text-orange-600 px-6 py-2 rounded-lg font-medium border border-orange-600 hover:bg-orange-50 transition-colors">
                        Learn More
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Load More */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-12"
          >
            <button className="bg-white border border-gray-200 text-gray-700 px-8 py-3 rounded-lg font-medium hover:border-blue-300 hover:text-blue-600 transition-colors">
              Load More
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
} 