'use client';

import { motion } from 'framer-motion';
import { FaRobot, FaFolder, FaBookmark, FaEllipsisV, FaCalendarAlt, FaDollarSign } from 'react-icons/fa';
import { ProjectData } from './AIOnboardingFlow';

export interface Project {
  id: string;
  name: string;
  isAIEnabled: boolean;
  savedItemsCount: number;
  createdAt: Date;
  aiData?: ProjectData;
}

interface ProjectDashboardProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
  onSaveItem: (projectId: string) => void;
}

export default function ProjectDashboard({ 
  projects, 
  onProjectClick, 
  onSaveItem 
}: ProjectDashboardProps) {
  const handleSaveItem = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveItem(projectId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Projects</h2>
        <div className="text-sm text-gray-500">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
            onClick={() => onProjectClick(project)}
            whileHover={{ scale: 1.02 }}
          >
            {/* Project Header */}
            <div className="p-6 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <FaFolder className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{project.name}</h3>
                    <p className="text-sm text-gray-500">
                      Created {project.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <button className="text-gray-400 hover:text-gray-600 p-1">
                  <FaEllipsisV className="w-4 h-4" />
                </button>
              </div>

              {/* AI Status Badge */}
              <div className="flex items-center gap-2 mb-4">
                {project.isAIEnabled ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
                    <FaRobot className="w-3 h-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-800">AI Enabled</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                    <FaFolder className="w-3 h-3 text-gray-600" />
                    <span className="text-xs font-medium text-gray-700">Basic Folder</span>
                  </div>
                )}
              </div>

              {/* Saved Items Count */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FaBookmark className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {project.savedItemsCount} saved items
                  </span>
                </div>
                
                <button
                  onClick={(e) => handleSaveItem(project.id, e)}
                  className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Save Item
                </button>
              </div>

              {/* AI Project Details */}
              {project.isAIEnabled && project.aiData && (
                <div className="space-y-2 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <FaCalendarAlt className="w-3 h-3" />
                    <span>{project.aiData.timeline}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <FaDollarSign className="w-3 h-3" />
                    <span>{project.aiData.budget}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {project.aiData.rooms.slice(0, 2).map((room) => (
                      <span
                        key={room}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md"
                      >
                        {room.replace('-', ' ')}
                      </span>
                    ))}
                    {project.aiData.rooms.length > 2 && (
                      <span className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-md">
                        +{project.aiData.rooms.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Progress indicator for non-AI projects */}
              {!project.isAIEnabled && project.savedItemsCount > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">Progress to AI upgrade</span>
                    <span className="text-xs text-gray-600">{project.savedItemsCount}/5</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((project.savedItemsCount / 5) * 100, 100)}%` }}
                    />
                  </div>
                  {project.savedItemsCount >= 5 && (
                    <p className="text-xs text-green-600 mt-1">Ready for AI upgrade!</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {projects.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaFolder className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-600">Create your first project to get started!</p>
        </motion.div>
      )}
    </div>
  );
} 