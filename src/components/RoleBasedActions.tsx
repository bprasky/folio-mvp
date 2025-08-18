'use client';

import Link from 'next/link';
import { FaPlus, FaCog, FaCalendarAlt, FaUsers } from 'react-icons/fa';

interface RoleBasedActionsProps {
  userRole: string;
  className?: string;
}

export default function RoleBasedActions({ userRole, className = '' }: RoleBasedActionsProps) {
  if (!userRole || userRole.toLowerCase() === 'guest') {
    return null;
  }

  const getActions = () => {
    switch (userRole.toLowerCase()) {
      case 'admin':
        return [
          {
            href: '/events/create',
            label: 'Create Event',
            icon: FaPlus,
            variant: 'primary' as const
          },
          {
            href: '/admin/events',
            label: 'Manage Events',
            icon: FaCog,
            variant: 'secondary' as const
          },
          {
            href: '/admin/festivals/create',
            label: 'Create Festival',
            icon: FaPlus,
            variant: 'secondary' as const
          }
        ];
      case 'vendor':
        return [
          {
            href: '/events/create',
            label: 'Create Event',
            icon: FaPlus,
            variant: 'primary' as const
          },
          {
            href: '/vendor/dashboard',
            label: 'My Events',
            icon: FaCalendarAlt,
            variant: 'secondary' as const
          }
        ];
      case 'designer':
        return [
          {
            href: '/designer/events/schedule',
            label: 'My Schedule',
            icon: FaCalendarAlt,
            variant: 'primary' as const
          },
          {
            href: '/designer',
            label: 'Dashboard',
            icon: FaUsers,
            variant: 'secondary' as const
          }
        ];
      case 'homeowner':
        return [
          {
            href: '/homeowner',
            label: 'My Projects',
            icon: FaUsers,
            variant: 'primary' as const
          }
        ];
      default:
        return [];
    }
  };

  const actions = getActions();

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {actions.map((action, index) => {
        const Icon = action.icon;
        const isPrimary = action.variant === 'primary';
        
        return (
          <Link
            key={index}
            href={action.href}
            className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isPrimary
                ? 'bg-folio-accent text-white hover:bg-folio-accent-dark shadow-sm'
                : 'bg-white text-folio-text border border-folio-border hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4 mr-2" />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
} 