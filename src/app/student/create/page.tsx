'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  FaGraduationCap, 
  FaPalette, 
  FaLightbulb, 
  FaUsers, 
  FaBell,
  FaArrowLeft
} from 'react-icons/fa';

export default function StudentCreate() {
  return (
    <div className="min-h-screen bg-primary flex">
      
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8"
          >
            <Link
              href="/student"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <FaArrowLeft />
              <span>Back to Student Dashboard</span>
            </Link>
          </motion.div>

          {/* Main Content */}
          <div className="text-center">
            {/* Hero Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-12"
            >
              <div className="relative mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6"
                >
                  <FaPalette className="text-white text-3xl" />
                </motion.div>
                
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-5xl font-bold text-gray-900 mb-4"
                >
                  Student Creation Tools
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-xl text-gray-600 max-w-2xl mx-auto"
                >
                  We're building amazing creation tools specifically designed for design students. 
                  Get ready for portfolio builders, project collaboration, and more!
                </motion.p>
              </div>
            </motion.div>

            {/* Coming Soon Features */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
            >
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
                  <FaGraduationCap className="text-blue-600 text-xl" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Portfolio Builder</h3>
                <p className="text-gray-600 text-sm">
                  Create stunning portfolios to showcase your best work and impress potential employers.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
                  <FaUsers className="text-purple-600 text-xl" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Group Projects</h3>
                <p className="text-gray-600 text-sm">
                  Collaborate with classmates on design projects with real-time editing and feedback.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
                  <FaLightbulb className="text-green-600 text-xl" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Design Challenges</h3>
                <p className="text-gray-600 text-sm">
                  Participate in weekly design challenges and compete with students worldwide.
                </p>
              </div>
            </motion.div>

            {/* Notification Signup */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white"
            >
              <div className="flex items-center justify-center mb-4">
                <FaBell className="text-2xl mr-3" />
                <h2 className="text-2xl font-bold">Get Notified When We Launch</h2>
              </div>
              
              <p className="text-blue-100 mb-6 max-w-md mx-auto">
                Be the first to know when our student creation tools are ready. 
                We'll send you early access and exclusive features!
              </p>

              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your student email"
                  className="flex-1 px-4 py-3 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
                />
                <button className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
                  Notify Me
                </button>
              </div>
            </motion.div>

            {/* Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="mt-12 bg-white rounded-2xl p-8 shadow-lg"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Launch Timeline</h2>
              <div className="space-y-4 text-left max-w-md mx-auto">
                <div className="flex items-center space-x-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div>
                    <div className="font-semibold text-gray-900">Q1 2024</div>
                    <div className="text-gray-600 text-sm">Portfolio Builder Beta</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div>
                    <div className="font-semibold text-gray-900">Q2 2024</div>
                    <div className="text-gray-600 text-sm">Group Collaboration Tools</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div>
                    <div className="font-semibold text-gray-900">Q3 2024</div>
                    <div className="text-gray-600 text-sm">Design Challenges & Competitions</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
} 