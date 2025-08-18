'use client';

import { motion } from 'framer-motion';
import { useRole } from '../contexts/RoleContext';
import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import { FaUser, FaSignOutAlt, FaCog, FaChevronDown } from 'react-icons/fa';

export default function GlobalHeader() {
  const { role } = useRole();
  const { data: session } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      console.log('DEBUG: Starting sign-out process...');
      await signOut({ redirect: false });
      console.log('DEBUG: Sign-out completed, hard navigating...');
      // Hard navigation clears client state
      window.location.replace('/auth/signin');
    } catch (error) {
      console.error('DEBUG: Sign-out error:', error);
      // Fallback: force redirect to sign-in page
      window.location.replace('/auth/signin');
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="TopBar sticky top-0 z-30 p-4 w-full bg-white/80 backdrop-blur-sm border-b border-folio-border flex items-center justify-between"
    >
      <div className="flex items-center gap-4 w-full">
        {/* Role Indicator */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-folio-border"
        >
          <span className="text-xs text-folio-system">Viewing as:</span>
          <span className="text-xs font-medium text-folio-text capitalize">
            {role}
          </span>
        </motion.div>

        {/* Profile Dropdown */}
        {session?.user && (
          <div className="relative ml-auto" ref={dropdownRef}>
            <motion.button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-folio-border hover:bg-white transition-all duration-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-folio-accent to-folio-system rounded-full flex items-center justify-center">
                <FaUser className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-folio-text">{session.user.name || session.user.email}</p>
                <p className="text-xs text-folio-system capitalize">{session.user.role}</p>
              </div>
              <FaChevronDown className={`w-3 h-3 text-folio-system transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </motion.button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
              >
                {/* User Info */}
                <div className="p-4 border-b border-folio-muted">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-folio-accent to-folio-system rounded-full flex items-center justify-center">
                      <FaUser className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-folio-text">{session.user.name || 'User'}</p>
                      <p className="text-sm text-folio-system">{session.user.email}</p>
                      <p className="text-xs text-folio-system capitalize">{session.user.role} • {role}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-2">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      // Add settings navigation here if needed
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-folio-muted transition-colors"
                  >
                    <FaCog className="w-4 h-4 text-folio-system" />
                    <span className="text-sm text-folio-text">Settings</span>
                  </button>
                  
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-red-50 transition-colors"
                  >
                    <FaSignOutAlt className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600 font-medium">Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.header>
  );
} 