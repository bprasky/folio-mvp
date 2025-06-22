'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronDown, FaHome, FaPalette, FaStore, FaSpinner, FaGraduationCap } from 'react-icons/fa';
import { useRole } from '../contexts/RoleContext';

export type UserRole = 'homeowner' | 'designer' | 'vendor' | 'student';

interface RoleOption {
  value: UserRole;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
}

const roleOptions: RoleOption[] = [
  {
    value: 'homeowner',
    label: 'Homeowner',
    icon: FaHome,
    color: 'bg-blue-500',
    description: 'Looking for design inspiration'
  },
  {
    value: 'designer',
    label: 'Designer',
    icon: FaPalette,
    color: 'bg-purple-500',
    description: 'Creating beautiful spaces'
  },
  {
    value: 'vendor',
    label: 'Vendor',
    icon: FaStore,
    color: 'bg-green-500',
    description: 'Showcasing products'
  },
  {
    value: 'student',
    label: 'Student',
    icon: FaGraduationCap,
    color: 'bg-cyan-500',
    description: 'Learning and building portfolio'
  }
];

export default function RoleSelector() {
  const { role, setRole, isLoading } = useRole();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentRole = roleOptions.find(option => option.value === role);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setIsOpen(false);
  };

  if (!currentRole) return null;

  const CurrentIcon = currentRole.icon;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-3 px-4 py-2 rounded-xl border border-gray-200 
          bg-white shadow-sm hover:shadow-md transition-all duration-200
          ${isOpen ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        disabled={isLoading}
      >
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <FaSpinner className="w-4 h-4 text-gray-500" />
          </motion.div>
        ) : (
          <div className={`w-3 h-3 rounded-full ${currentRole.color}`} />
        )}
        
        <span className="text-sm font-medium text-gray-700 hidden sm:inline">
          {currentRole.label}
        </span>
        
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <FaChevronDown className="w-3 h-3 text-gray-400" />
        </motion.div>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
          >
            <div className="p-2">
              {roleOptions.map((option, index) => {
                const Icon = option.icon;
                const isSelected = option.value === role;
                
                return (
                  <motion.button
                    key={option.value}
                    onClick={() => handleRoleSelect(option.value)}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg text-left
                      transition-all duration-200 group
                      ${isSelected 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'hover:bg-gray-50 border border-transparent'
                      }
                    `}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center text-white
                      ${option.color} group-hover:scale-110 transition-transform duration-200
                    `}>
                      <Icon className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{option.label}</div>
                      <div className="text-xs text-gray-500">{option.description}</div>
                    </div>
                    
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-2 h-2 bg-blue-500 rounded-full"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 