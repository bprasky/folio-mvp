'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaUserGraduate, FaStar, FaMapMarkerAlt, FaCheck, FaClock, FaHeart, FaComment, FaVideo, FaCalendarAlt, FaFilter } from 'react-icons/fa';
import Navigation from '../../../components/Navigation';
import { useRole } from '../../../contexts/RoleContext';

// Mock mentorship data
const availableMentors = [
  {
    id: 1,
    name: 'Sarah Martinez',
    title: 'Principal Designer at Martinez Design Co.',
    avatar: 'SM',
    location: 'San Francisco, CA',
    specialties: ['Residential Design', 'Sustainable Materials', 'Project Management'],
    experience: '12 years',
    rating: 4.9,
    reviews: 28,
    mentees: 15,
    availability: 'Taking new mentees',
    priceRange: 'Free - $50/session',
    bio: 'Passionate about nurturing the next generation of designers. I specialize in sustainable residential design and love sharing real-world project insights.',
    achievements: ['LEED Certified', 'Featured in Architectural Digest', '2023 Design Award Winner'],
    mentorshipStyle: 'Hands-on project guidance with weekly check-ins',
    responseTime: '< 24 hours',
    languages: ['English', 'Spanish'],
    image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 2,
    name: 'David Kim',
    title: 'Senior Designer at Studio Verde',
    avatar: 'DK',
    location: 'New York, NY',
    specialties: ['Color Theory', 'Space Planning', 'Client Relations'],
    experience: '8 years',
    rating: 4.8,
    reviews: 34,
    mentees: 22,
    availability: 'Waitlist available',
    priceRange: '$25 - $75/session',
    bio: 'Former student turned successful designer. I understand the challenges of breaking into the industry and love helping students navigate their career path.',
    achievements: ['Published Author', 'Industry Speaker', 'Mentor of the Year 2023'],
    mentorshipStyle: 'Career-focused with portfolio development',
    responseTime: '< 48 hours',
    languages: ['English', 'Korean'],
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 3,
    name: 'Emma Rodriguez',
    title: 'Freelance Interior Designer',
    avatar: 'ER',
    location: 'Austin, TX',
    specialties: ['Small Space Design', 'Budget-Friendly Solutions', 'DIY Projects'],
    experience: '6 years',
    rating: 4.7,
    reviews: 19,
    mentees: 8,
    availability: 'Taking new mentees',
    priceRange: 'Free - $30/session',
    bio: 'Recent graduate who built a successful freelance practice. Perfect for students looking to understand the business side of design.',
    achievements: ['Top Freelancer 2023', 'Instagram 50k+ followers', 'Published in Design Milk'],
    mentorshipStyle: 'Business development and social media growth',
    responseTime: '< 12 hours',
    languages: ['English'],
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80'
  }
];

const currentMentorship = {
  mentor: availableMentors[0],
  startDate: '2024-01-15',
  nextSession: '2024-02-15 2:00 PM',
  totalSessions: 8,
  completedSessions: 5,
  currentGoals: [
    { goal: 'Complete portfolio website', progress: 80, dueDate: '2024-02-20' },
    { goal: 'Learn space planning fundamentals', progress: 60, dueDate: '2024-03-01' },
    { goal: 'Practice client presentation skills', progress: 40, dueDate: '2024-03-15' }
  ],
  recentFeedback: "Great progress on your portfolio! Your use of color is really improving. Let's focus on space planning techniques in our next session.",
  upcomingTasks: [
    'Review space planning assignment',
    'Prepare questions for next session',
    'Update portfolio with latest project'
  ]
};

export default function StudentMentorship() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState('current');
  const [filter, setFilter] = useState('all');
  const [hasMentor, setHasMentor] = useState(true); // Set to true to show current mentorship

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

  const filteredMentors = filter === 'all' 
    ? availableMentors 
    : availableMentors.filter(mentor => 
        mentor.specialties.some(specialty => 
          specialty.toLowerCase().includes(filter.toLowerCase())
        )
      );

  const renderCurrentMentorship = () => (
    <div className="space-y-6">
      {/* Current Mentor Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
      >
        <div className="flex items-start gap-6">
          <div className="relative">
            <img 
              src={currentMentorship.mentor.image} 
              alt={currentMentorship.mentor.name}
              className="w-20 h-20 rounded-full object-cover"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <FaCheck className="w-3 h-3 text-white" />
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-1">{currentMentorship.mentor.name}</h3>
            <p className="text-gray-600 mb-2">{currentMentorship.mentor.title}</p>
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              <div className="flex items-center gap-1">
                <FaMapMarkerAlt />
                {currentMentorship.mentor.location}
              </div>
              <div className="flex items-center gap-1">
                <FaStar className="text-yellow-500" />
                {currentMentorship.mentor.rating} ({currentMentorship.mentor.reviews} reviews)
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {currentMentorship.mentor.specialties.map((specialty) => (
                <span key={specialty} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                  {specialty}
                </span>
              ))}
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-500 mb-2">Mentorship since</div>
            <div className="font-medium text-gray-900">{new Date(currentMentorship.startDate).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Progress Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{currentMentorship.completedSessions}</div>
            <div className="text-sm text-gray-500">Sessions Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{currentMentorship.totalSessions - currentMentorship.completedSessions}</div>
            <div className="text-sm text-gray-500">Sessions Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">3</div>
            <div className="text-sm text-gray-500">Active Goals</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mt-6">
          <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <FaVideo />
            Schedule Session
          </button>
          <button className="flex-1 border border-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-2">
            <FaComment />
            Send Message
          </button>
        </div>
      </motion.div>

      {/* Next Session */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
      >
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Next Session</h4>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <FaCalendarAlt className="text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">{currentMentorship.nextSession}</div>
            <div className="text-sm text-gray-500">Space Planning Review & Portfolio Feedback</div>
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Join Session
          </button>
        </div>
      </motion.div>

      {/* Current Goals */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
      >
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Current Goals</h4>
        <div className="space-y-4">
          {currentMentorship.currentGoals.map((goal, index) => (
            <div key={index} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium text-gray-900">{goal.goal}</h5>
                <span className="text-sm text-gray-500">Due: {goal.dueDate}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
              <div className="text-sm text-gray-600 mt-1">{goal.progress}% complete</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Feedback */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
      >
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Feedback</h4>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-gray-700 italic">"{currentMentorship.recentFeedback}"</p>
          <div className="text-sm text-gray-500 mt-2">- {currentMentorship.mentor.name}</div>
        </div>
      </motion.div>

      {/* Upcoming Tasks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
      >
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Tasks</h4>
        <div className="space-y-3">
          {currentMentorship.upcomingTasks.map((task, index) => (
            <div key={index} className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-gray-700">{task}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const renderFindMentors = () => (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <FaFilter className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter by specialty:</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {['all', 'residential design', 'sustainable materials', 'color theory', 'space planning', 'client relations'].map((specialty) => (
            <button
              key={specialty}
              onClick={() => setFilter(specialty)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all capitalize ${
                filter === specialty
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
              }`}
            >
              {specialty}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Available Mentors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMentors.map((mentor, index) => (
          <motion.div
            key={mentor.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
          >
            {/* Mentor Header */}
            <div className="flex items-start gap-4 mb-4">
              <img 
                src={mentor.image} 
                alt={mentor.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{mentor.name}</h3>
                <p className="text-gray-600 text-sm mb-2">{mentor.title}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <FaMapMarkerAlt />
                    {mentor.location}
                  </div>
                  <div className="flex items-center gap-1">
                    <FaStar className="text-yellow-500" />
                    {mentor.rating} ({mentor.reviews})
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                mentor.availability === 'Taking new mentees' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {mentor.availability}
              </div>
            </div>

            {/* Bio */}
            <p className="text-gray-600 text-sm mb-4">{mentor.bio}</p>

            {/* Specialties */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Specialties:</div>
              <div className="flex flex-wrap gap-2">
                {mentor.specialties.map((specialty) => (
                  <span key={specialty} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                    {specialty}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="font-bold text-gray-900">{mentor.experience}</div>
                <div className="text-xs text-gray-500">Experience</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900">{mentor.mentees}</div>
                <div className="text-xs text-gray-500">Mentees</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900">{mentor.responseTime}</div>
                <div className="text-xs text-gray-500">Response</div>
              </div>
            </div>

            {/* Achievements */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Achievements:</div>
              <div className="flex flex-wrap gap-2">
                {mentor.achievements.slice(0, 2).map((achievement) => (
                  <span key={achievement} className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">
                    {achievement}
                  </span>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Price:</span> {mentor.priceRange}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Style:</span> {mentor.mentorshipStyle.split(' ').slice(0, 3).join(' ')}...
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Request Mentorship
              </button>
              <button className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:border-blue-300 hover:text-blue-600 transition-colors">
                View Profile
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Mentorship</h1>
            <p className="text-gray-600">Connect with experienced designers and accelerate your learning journey</p>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('current')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'current'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {hasMentor ? 'Current Mentorship' : 'Getting Started'}
              </button>
              <button
                onClick={() => setActiveTab('find')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'find'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                Find Mentors
              </button>
            </div>
          </motion.div>

          {/* Tab Content */}
          {activeTab === 'current' && hasMentor && renderCurrentMentorship()}
          {activeTab === 'find' && renderFindMentors()}
          
          {/* Getting Started (when no mentor) */}
          {activeTab === 'current' && !hasMentor && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="text-gray-400 mb-6">
                <FaUserGraduate className="text-6xl mx-auto mb-4" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Start Your Mentorship Journey</h3>
              <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                Connect with experienced designers who can guide your learning, provide career advice, 
                and help you build a strong portfolio. Our mentors are industry professionals ready to 
                share their knowledge and experience.
              </p>
              <button 
                onClick={() => setActiveTab('find')}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Find Your Mentor
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
} 