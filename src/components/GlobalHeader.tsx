'use client';

import { motion } from 'framer-motion';
import RoleSelector from './RoleSelector';
import { useRole } from '../contexts/RoleContext';

export default function GlobalHeader() {
  const { role } = useRole();

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 right-0 z-50 p-4"
    >
      <div className="flex items-center gap-4">
        {/* Role Indicator */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200"
        >
          <span className="text-xs text-gray-500">Viewing as:</span>
          <span className="text-xs font-medium text-gray-700 capitalize">
            {role}
          </span>
        </motion.div>

        {/* Role Selector */}
        <RoleSelector />
      </div>
    </motion.header>
  );
} 