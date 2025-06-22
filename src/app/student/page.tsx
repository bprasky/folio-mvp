'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaGraduationCap, FaChalkboardTeacher, FaUserGraduate, FaStar, FaPlus, FaHeart, FaComment, FaShare, FaBookmark, FaTrophy, FaClock } from 'react-icons/fa';
import Navigation from '../../components/Navigation';
import { useRole } from '../../contexts/RoleContext';

// Mock student profile data
const studentProfile = {
  name: 'Alex Chen',
  school: 'Parsons School of Design',
  graduationYear: 2025,
  designFocus: 'Sustainable Interior Design',
  portfolioUrl: 'alexchen.design',
  points: 1240,
  level: 'Rising Designer',
  completedClasses: 8,
  mentorshipStatus: 'Active with Sarah Martinez',
  achievements: [
    { title: 'First Portfolio Project', icon: '🎨', date: '2 weeks ago' },
    { title: 'Completed 5 Classes', icon: '📚', date: '1 month ago' },
    { title: 'Student Spotlight Feature', icon: '⭐', date: '2 months ago' }
  ]
};

// Mock explore feed data
const exploreFeed = [
  {
    id: 1,
    type: 'student_spotlight',
    author: 'Emma Rodriguez',
    school: 'RISD',
    title: 'Biophilic Apartment Redesign',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    description: 'A sustainable approach to small space living using natural materials and plants.',
    likes: 89,
    comments: 12,
    timeAgo: '2 hours ago',
    tags: ['Sustainable', 'Small Space', 'Biophilic']
  },
  {
    id: 2,
    type: 'muscle_class',
    instructor: 'David Kim',
    title: 'Color Psychology in Residential Spaces',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    description: 'Learn how color choices affect mood and behavior in home environments.',
    duration: '45 min',
    difficulty: 'Beginner',
    enrolled: 234,
    rating: 4.8
  },
  {
    id: 3,
    type: 'collaboration',
    author: 'Maya Patel',
    school: 'Art Center',
    title: 'Looking for partner: Modern Kitchen Design Challenge',
    description: 'Seeking a student interested in sustainable materials for a collaborative project.',
    timeAgo: '1 day ago',
    responses: 8
  },
  {
    id: 4,
    type: 'internship',
    company: 'Studio Verde',
    title: 'Summer Design Intern',
    location: 'San Francisco, CA',
    description: 'Join our team for hands-on experience in sustainable residential design.',
    deadline: '2 weeks',
    applicants: 45
  }
];

export default function StudentDashboard() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState('explore');

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

  const renderExploreTab = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FaTrophy className="text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{studentProfile.points}</div>
              <div className="text-sm text-gray-500">Points</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FaChalkboardTeacher className="text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{studentProfile.completedClasses}</div>
              <div className="text-sm text-gray-500">Classes</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FaUserGraduate className="text-purple-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">Active</div>
              <div className="text-sm text-gray-500">Mentorship</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <FaStar className="text-orange-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{studentProfile.level}</div>
              <div className="text-sm text-gray-500">Level</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Explore Feed */}
      <div className="space-y-6">
        {exploreFeed.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            {item.type === 'student_spotlight' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                    {item.author?.[0] || 'S'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{item.author}</div>
                    <div className="text-sm text-gray-500">{item.school} • {item.timeAgo}</div>
                  </div>
                  <div className="ml-auto">
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                      Student Spotlight
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
                      {tag}
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
                    <FaShare />
                  </button>
                  <button className="flex items-center gap-2 text-gray-600 hover:text-yellow-500 transition-colors ml-auto">
                    <FaBookmark />
                  </button>
                </div>
              </div>
            )}

            {item.type === 'muscle_class' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                    <FaChalkboardTeacher />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{item.instructor}</div>
                    <div className="text-sm text-gray-500">Instructor</div>
                  </div>
                  <div className="ml-auto">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                      Muscle Class
                    </span>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 mb-4">{item.description}</p>
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <FaClock />
                    {item.duration}
                  </div>
                  <div className="text-sm text-gray-600">
                    {item.difficulty}
                  </div>
                  <div className="text-sm text-gray-600">
                    {item.enrolled} enrolled
                  </div>
                  <div className="text-sm text-gray-600">
                    ⭐ {item.rating}
                  </div>
                </div>
                
                <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Enroll in Class
                </button>
              </div>
            )}

            {item.type === 'collaboration' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                    {item.author?.[0] || 'C'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{item.author}</div>
                    <div className="text-sm text-gray-500">{item.school} • {item.timeAgo}</div>
                  </div>
                  <div className="ml-auto">
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                      Collaboration
                    </span>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 mb-4">{item.description}</p>
                
                <div className="flex items-center gap-4">
                  <button className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
                    Apply to Collaborate
                  </button>
                  <span className="text-sm text-gray-600">{item.responses} responses</span>
                </div>
              </div>
            )}

            {item.type === 'internship' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                    {item.company?.[0] || 'I'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{item.company}</div>
                    <div className="text-sm text-gray-500">{item.location}</div>
                  </div>
                  <div className="ml-auto">
                    <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                      Internship
                    </span>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 mb-4">{item.description}</p>
                
                <div className="flex items-center gap-4">
                  <button className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors">
                    Apply Now
                  </button>
                  <span className="text-sm text-gray-600">Deadline: {item.deadline}</span>
                  <span className="text-sm text-gray-600">{item.applicants} applicants</span>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-primary flex">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {studentProfile.name[0]}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Welcome back, {studentProfile.name.split(' ')[0]}!</h1>
                <p className="text-gray-600">{studentProfile.school} • {studentProfile.designFocus}</p>
              </div>
            </div>

            {/* Recent Achievements */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Achievements</h3>
              <div className="space-y-3">
                {studentProfile.achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-2xl">{achievement.icon}</span>
                    <div>
                      <div className="font-medium text-gray-900">{achievement.title}</div>
                      <div className="text-sm text-gray-500">{achievement.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Main Content */}
          {renderExploreTab()}
        </div>
      </div>
    </div>
  );
} 