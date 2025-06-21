'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaHome, FaLightbulb, FaNewspaper, FaStore, FaUsers, FaUser, FaPlus, FaSearch, FaEdit, FaTrash, FaChartLine, FaBriefcase } from 'react-icons/fa';

export default function DesignerProfile() {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'projects'>('portfolio');

  const mockProjects = [
    {
      id: 1,
      title: 'Modern Living Room',
      category: 'Interior Design',
      client: 'Private Residence',
      image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace',
      views: 2345,
      likes: 189
    },
    {
      id: 2,
      title: 'Office Space Redesign',
      category: 'Commercial',
      client: 'Tech Corp',
      image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72',
      views: 1876,
      likes: 145
    },
    // Add more mock projects as needed
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="glass-panel w-20 lg:w-56 p-4 lg:p-6 fixed h-full z-20 flex flex-col items-center lg:items-start">
        <div className="w-10 h-10 rounded bg-gradient-to-br from-amber-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl mb-8">F</div>
        <nav className="flex-1 flex flex-col items-center lg:items-start space-y-4">
          <Link href="/" className="p-3 rounded hover:bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaHome className="text-lg" />
            <span className="hidden lg:inline ml-3">Home</span>
          </Link>
          <Link href="/inspire" className="p-3 rounded hover:bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaLightbulb className="text-lg" />
            <span className="hidden lg:inline ml-3">Inspire</span>
          </Link>
          <Link href="/editorials" className="p-3 rounded hover:bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaNewspaper className="text-lg" />
            <span className="hidden lg:inline ml-3">Editorials</span>
          </Link>
          <Link href="/vendor" className="p-3 rounded hover:bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaStore className="text-lg" />
            <span className="hidden lg:inline ml-3">Shop</span>
          </Link>
          <Link href="/community" className="p-3 rounded hover:bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaUsers className="text-lg" />
            <span className="hidden lg:inline ml-3">Community</span>
          </Link>
          <Link href="/designer" className="p-3 rounded bg-gray-800 flex flex-col items-center lg:flex-row lg:items-center w-full">
            <FaUser className="text-lg" />
            <span className="hidden lg:inline ml-3">Profile</span>
          </Link>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-20 xl:ml-56 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Designer Dashboard</h1>
            <p className="text-gray-400">Showcase your work and manage projects</p>
          </div>
          <button className="bg-gradient-to-r from-amber-500 to-pink-500 text-white px-6 py-2 rounded-md flex items-center">
            <FaPlus className="mr-2" /> Add Project
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            className={`px-4 py-2 rounded-md flex items-center ${
              activeTab === 'portfolio' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('portfolio')}
          >
            <FaBriefcase className="mr-2" /> Portfolio
          </button>
          <button
            className={`px-4 py-2 rounded-md flex items-center ${
              activeTab === 'projects' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('projects')}
          >
            <FaBriefcase className="mr-2" /> Projects
          </button>
          <Link
            href="/designer/analytics"
            className="px-4 py-2 rounded-md flex items-center text-gray-400 hover:text-white"
          >
            <FaChartLine className="mr-2" /> Analytics
          </Link>
        </div>

        {/* Content */}
        {activeTab === 'portfolio' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockProjects.map((project) => (
              <div key={project.id} className="glass-panel rounded-lg overflow-hidden">
                <div className="relative h-64">
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                      <p className="text-gray-400 text-sm">{project.category}</p>
                    </div>
                    <span className="text-amber-500 text-sm">{project.client}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
                    <span>Views: {project.views}</span>
                    <span>Likes: {project.likes}</span>
                  </div>
                  <div className="flex space-x-2">
                    <button className="flex-1 bg-gray-800 text-white py-2 rounded-md flex items-center justify-center">
                      <FaEdit className="mr-2" /> Edit
                    </button>
                    <button className="flex-1 bg-red-500 text-white py-2 rounded-md flex items-center justify-center">
                      <FaTrash className="mr-2" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="glass-panel p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-white mb-4">Active Projects</h2>
            <p className="text-gray-400">Project management content coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
} 