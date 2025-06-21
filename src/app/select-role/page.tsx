'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FaStore, FaUser, FaArrowRight } from 'react-icons/fa';

export default function SelectRole() {
  const [selectedRole, setSelectedRole] = useState<'vendor' | 'designer' | null>(null);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Choose Your Role</h1>
          <p className="text-gray-400 text-lg">Select how you want to use Folio</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Vendor Card */}
          <div 
            className={`glass-panel p-8 rounded-lg cursor-pointer transition-all duration-300 ${
              selectedRole === 'vendor' ? 'ring-2 ring-amber-500' : ''
            }`}
            onClick={() => setSelectedRole('vendor')}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-pink-500 flex items-center justify-center mb-6">
                <FaStore className="text-3xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Vendor</h2>
              <p className="text-gray-400 mb-6">
                Showcase your products and connect with designers. Manage your catalog and track engagement.
              </p>
              <ul className="text-left text-gray-300 space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-amber-500 rounded-full mr-3"></span>
                  Product catalog management
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-amber-500 rounded-full mr-3"></span>
                  Analytics and insights
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-amber-500 rounded-full mr-3"></span>
                  Designer connections
                </li>
              </ul>
            </div>
          </div>

          {/* Designer Card */}
          <div 
            className={`glass-panel p-8 rounded-lg cursor-pointer transition-all duration-300 ${
              selectedRole === 'designer' ? 'ring-2 ring-amber-500' : ''
            }`}
            onClick={() => setSelectedRole('designer')}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-pink-500 flex items-center justify-center mb-6">
                <FaUser className="text-3xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Designer</h2>
              <p className="text-gray-400 mb-6">
                Create your portfolio, share your work, and connect with vendors. Build your professional network.
              </p>
              <ul className="text-left text-gray-300 space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-amber-500 rounded-full mr-3"></span>
                  Portfolio showcase
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-amber-500 rounded-full mr-3"></span>
                  Project management
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-amber-500 rounded-full mr-3"></span>
                  Vendor collaborations
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <Link 
            href={selectedRole ? `/${selectedRole}` : '#'}
            className={`inline-flex items-center px-8 py-3 rounded-md text-lg font-medium transition-all duration-300 ${
              selectedRole 
                ? 'bg-gradient-to-r from-amber-500 to-pink-500 text-white hover:opacity-90' 
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue
            <FaArrowRight className="ml-2" />
          </Link>
        </div>
      </div>
    </div>
  );
} 