'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FaUser, FaPaintBrush, FaStore } from 'react-icons/fa';
import { motion } from 'framer-motion';

type DemoRole = 'INDIVIDUAL' | 'DESIGNER' | 'VENDOR';

const roleConfig: Record<DemoRole, { label: string; icon: typeof FaUser; color: string }> = {
  INDIVIDUAL: {
    label: 'Individual',
    icon: FaUser,
    color: 'bg-[var(--accent)]',
  },
  DESIGNER: {
    label: 'Designer',
    icon: FaPaintBrush,
    color: 'bg-purple-500',
  },
  VENDOR: {
    label: 'Vendor',
    icon: FaStore,
    color: 'bg-green-500',
  },
};

export default function DemoRoleSwitcher() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isChanging, setIsChanging] = useState(false);

  // Debug logging
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      console.log('[DemoRoleSwitcher] Session:', {
        email: session.user.email,
        role: session.user.role,
        status,
      });
    }
  }, [session, status]);

  // Only show for demo@folio.com OR admin users
  // Check both session and make sure email matches exactly (case-insensitive) OR user is admin
  const userEmail = session?.user?.email?.toLowerCase();
  const userRole = session?.user?.role?.toUpperCase();
  const isDemoUser = session?.user && userEmail === 'demo@folio.com';
  const isAdmin = userRole === 'ADMIN';
  const shouldShow = isDemoUser || isAdmin;
  
  if (!shouldShow) {
    return null;
  }

  const currentRole = (session.user.role?.toUpperCase() || 'INDIVIDUAL') as DemoRole;
  const roles: DemoRole[] = ['INDIVIDUAL', 'DESIGNER', 'VENDOR'];

  const handleRoleChange = async (newRole: DemoRole) => {
    if (newRole === currentRole || isChanging) return;

    setIsChanging(true);
    try {
      // Update role in database
      const response = await fetch('/api/demo/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      // Update session
      await update({
        ...session,
        user: {
          ...session.user,
          role: newRole,
        },
      });

      // Refresh the page to ensure all role-based logic updates
      router.refresh();
    } catch (error) {
      console.error('[DemoRoleSwitcher] Error changing role:', error);
      alert('Failed to change role. Please try again.');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white/95 backdrop-blur-md border-2 border-[var(--accent)]/30 rounded-xl shadow-lg p-3"
      data-demo-id="demo-role-switcher"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-700 mr-2">Demo Mode:</span>
        {roles.map((role) => {
          const config = roleConfig[role];
          const Icon = config.icon;
          const isActive = currentRole === role;

          return (
            <button
              key={role}
              onClick={() => handleRoleChange(role)}
              disabled={isChanging}
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                ${isActive
                  ? `${config.color} text-white shadow-md scale-105`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
                ${isChanging ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{config.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute inset-0 rounded-lg border-2 border-white"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
        {isChanging && (
          <div className="ml-2">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

