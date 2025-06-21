'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaRobot, FaFolder } from 'react-icons/fa';
import { useRole } from '../../contexts/RoleContext';
import ProjectCreationModal from '../../components/ProjectCreationModal';
import AIOnboardingFlow, { ProjectData } from '../../components/AIOnboardingFlow';
import AIUpgradeModal from '../../components/AIUpgradeModal';
import ProjectDashboard, { Project } from '../../components/ProjectDashboard';

export default function HomeownerDemo() {
  const { role } = useRole();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [currentProjectName, setCurrentProjectName] = useState('');
  const [selectedProjectForUpgrade, setSelectedProjectForUpgrade] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  // Initialize with some demo projects
  useEffect(() => {
    const demoProjects: Project[] = [
      {
        id: '1',
        name: 'Living Room Refresh',
        isAIEnabled: true,
        savedItemsCount: 8,
        createdAt: new Date('2024-01-15'),
        aiData: {
          name: 'Living Room Refresh',
          projectType: 'decorating',
          rooms: ['living-room'],
          budget: '$15,000 - $30,000',
          timeline: '3-6 months',
          location: '90210',
          style: ['Modern', 'Scandinavian']
        }
      },
      {
        id: '2',
        name: 'Master Bedroom',
        isAIEnabled: false,
        savedItemsCount: 3,
        createdAt: new Date('2024-01-20'),
      },
      {
        id: '3',
        name: 'Kitchen Renovation',
        isAIEnabled: false,
        savedItemsCount: 7,
        createdAt: new Date('2024-01-25'),
      }
    ];
    setProjects(demoProjects);
  }, []);

  const handleCreateProject = (projectName: string, useAI: boolean) => {
    setCurrentProjectName(projectName);
    setIsCreateModalOpen(false);
    
    if (useAI) {
      setIsOnboardingOpen(true);
    } else {
      // Create basic project
      const newProject: Project = {
        id: Date.now().toString(),
        name: projectName,
        isAIEnabled: false,
        savedItemsCount: 0,
        createdAt: new Date(),
      };
      setProjects(prev => [...prev, newProject]);
    }
  };

  const handleOnboardingComplete = (data: ProjectData) => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: data.name,
      isAIEnabled: true,
      savedItemsCount: 0,
      createdAt: new Date(),
      aiData: data
    };
    setProjects(prev => [...prev, newProject]);
    setIsOnboardingOpen(false);
    setCurrentProjectName('');
  };

  const handleSaveItem = (projectId: string) => {
    setProjects(prev => prev.map(project => {
      if (project.id === projectId) {
        const newCount = project.savedItemsCount + 1;
        
        // Check if non-AI project reaches 5 saves
        if (!project.isAIEnabled && newCount >= 5) {
          setSelectedProjectForUpgrade(projectId);
          setIsUpgradeModalOpen(true);
        }
        
        return { ...project, savedItemsCount: newCount };
      }
      return project;
    }));
  };

  const handleUpgradeToAI = () => {
    if (selectedProjectForUpgrade) {
      setCurrentProjectName(projects.find(p => p.id === selectedProjectForUpgrade)?.name || '');
      setIsUpgradeModalOpen(false);
      setIsOnboardingOpen(true);
    }
  };

  const handleUpgradeComplete = (data: ProjectData) => {
    if (selectedProjectForUpgrade) {
      setProjects(prev => prev.map(project => {
        if (project.id === selectedProjectForUpgrade) {
          return { ...project, isAIEnabled: true, aiData: data };
        }
        return project;
      }));
      setSelectedProjectForUpgrade(null);
    }
    setIsOnboardingOpen(false);
    setCurrentProjectName('');
  };

  const handleProjectClick = (project: Project) => {
    console.log('Project clicked:', project);
    // In a real app, this would navigate to the project detail page
  };

  // Show role selection if not homeowner
  if (role !== 'homeowner') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaFolder className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Homeowner Features</h2>
          <p className="text-gray-600 mb-4">
            Switch to "Homeowner" role using the dropdown in the top-right to see the project creation flow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to Your Design Journey
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Create projects, save inspiration, and get AI-powered design guidance
            </p>
            
            <motion.button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-2xl font-medium text-lg shadow-lg transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaPlus className="w-5 h-5" />
              Create New Project
            </motion.button>
          </motion.div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-6 shadow-lg"
            >
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mb-4">
                <FaRobot className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">AI-Guided Projects</h3>
              <p className="text-gray-600">
                Get personalized design guidance, budget help, and designer matches through our AI onboarding flow.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-lg"
            >
              <div className="w-12 h-12 bg-gray-600 rounded-xl flex items-center justify-center mb-4">
                <FaFolder className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Basic Folders</h3>
              <p className="text-gray-600">
                Start simple with basic folders. After saving 5+ items, unlock AI features for smarter suggestions.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Projects Dashboard */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <ProjectDashboard
          projects={projects}
          onProjectClick={handleProjectClick}
          onSaveItem={handleSaveItem}
        />
      </div>

      {/* Modals */}
      <ProjectCreationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateProject={handleCreateProject}
      />

      <AIOnboardingFlow
        isOpen={isOnboardingOpen}
        projectName={currentProjectName}
        onClose={() => {
          setIsOnboardingOpen(false);
          setCurrentProjectName('');
          setSelectedProjectForUpgrade(null);
        }}
        onComplete={selectedProjectForUpgrade ? handleUpgradeComplete : handleOnboardingComplete}
      />

      <AIUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => {
          setIsUpgradeModalOpen(false);
          setSelectedProjectForUpgrade(null);
        }}
        onUpgrade={handleUpgradeToAI}
        savedItemsCount={projects.find(p => p.id === selectedProjectForUpgrade)?.savedItemsCount || 0}
      />
    </div>
  );
} 