'use client';

import { motion } from 'framer-motion';
import { FaNewspaper, FaTh, FaVideo, FaUsers, FaUser } from 'react-icons/fa';

// Tab configuration exactly as requested
const profileTabs = [
  { name: "Feed", id: "feed", icon: FaNewspaper },
  { name: "Projects", id: "projects", icon: FaTh },
  { name: "Videos", id: "videos", icon: FaVideo },
  { name: "Team", id: "team", icon: FaUsers },
  { name: "About", id: "about", icon: FaUser }
];

interface DesignerProfileTopTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function DesignerProfileTopTabs({ activeTab, onTabChange }: DesignerProfileTopTabsProps) {
  return (
    <motion.div 
      className="bg-white rounded-2xl p-2 shadow-lg mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div className="flex">
        {profileTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium text-sm">{tab.name}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
} 