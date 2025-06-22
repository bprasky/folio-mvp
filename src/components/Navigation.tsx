'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaHome, FaLightbulb, FaNewspaper, FaStore, FaUsers, FaUser, FaPlus, FaBriefcase, FaGraduationCap, FaChalkboardTeacher, FaUserGraduate, FaStar } from 'react-icons/fa';
import { useRole } from '../contexts/RoleContext';

const Navigation = () => {
  const pathname = usePathname();
  const { role } = useRole();

  const baseNavItems = [
    { href: '/', icon: FaHome, label: 'Home' },
    { href: '/inspire', icon: FaLightbulb, label: 'Inspire' },
    { href: '/events', icon: FaNewspaper, label: 'Events' },
    { href: '/vendor', icon: FaStore, label: 'Shop' },
    { href: '/community', icon: FaUsers, label: 'Community' },
  ];

  const designerItems = role === 'designer' ? [
    { href: '/jobs', icon: FaBriefcase, label: 'Jobs' },
  ] : [];

  const studentItems = role === 'student' ? [
    { href: '/student/explore', icon: FaGraduationCap, label: 'Explore' },
    { href: '/student/classes', icon: FaChalkboardTeacher, label: 'Classes' },
    { href: '/student/mentorship', icon: FaUserGraduate, label: 'Mentorship' },
    { href: '/student/portfolio', icon: FaStar, label: 'Portfolio' },
  ] : [];

  const navItems = [
    ...baseNavItems,
    ...designerItems,
    ...studentItems,
    { href: '/select-role', icon: FaUser, label: 'Profile' },
  ];

  // Role-based design button configuration
  const getDesignButtonConfig = () => {
    switch (role) {
      case 'vendor':
        return {
          href: '/vendor',
          label: 'Add Product',
          action: 'product-upload' // We'll use this to trigger the modal
        };
      case 'designer':
        return {
          href: '/designer',
          label: 'Create'
        };
      case 'student':
        return {
          href: '/student/portfolio',
          label: 'Create'
        };
      default: // homeowner or no role
        return {
          href: '/homeowner-demo',
          label: 'Design'
        };
    }
  };

  const designButtonConfig = getDesignButtonConfig();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const handleDesignButtonClick = (e: React.MouseEvent) => {
    if (role === 'vendor') {
      if (pathname !== '/vendor') {
        // Navigate to vendor page with a parameter to trigger the modal
        window.location.href = '/vendor?openUploader=true';
      } else {
        // If already on vendor page, just trigger the modal
        console.log('Triggering product uploader event'); // Debug log
        window.dispatchEvent(new CustomEvent('openProductUploader'));
      }
    }
  };

  return (
    <div className="glass-panel w-20 lg:w-56 p-4 lg:p-6 fixed h-full z-20 flex flex-col items-center lg:items-start">
      {/* Logo */}
      <div 
        className="w-10 h-10 rounded flex items-center justify-center text-white font-bold text-xl mb-8"
        style={{ 
          background: `linear-gradient(135deg, var(--secondary-color) 0%, var(--accent-color) 100%)` 
        }}
      >
        F
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col items-center lg:items-start space-y-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`p-3 rounded flex flex-col items-center lg:flex-row lg:items-center w-full transition-all duration-200 ${
                active
                  ? 'bg-secondary text-primary shadow-lg'
                  : 'text-secondary hover:bg-secondary/10 hover:text-secondary'
              }`}
            >
              <Icon className="text-lg" />
              <span className="hidden lg:inline ml-3 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Design Button */}
      {role === 'vendor' ? (
        <button
          onClick={handleDesignButtonClick}
          className="hidden lg:flex w-full py-3 rounded font-medium items-center justify-center mt-auto transition-all duration-200 hover:shadow-lg"
          style={{ 
            background: `linear-gradient(135deg, var(--secondary-color) 0%, var(--accent-color) 100%)`,
            color: 'var(--primary-color)'
          }}
        >
          <FaPlus className="mr-2" /> {designButtonConfig.label}
        </button>
      ) : (
        <Link
          href={designButtonConfig.href}
          onClick={handleDesignButtonClick}
          className="hidden lg:flex w-full py-3 rounded font-medium items-center justify-center mt-auto transition-all duration-200 hover:shadow-lg"
          style={{ 
            background: `linear-gradient(135deg, var(--secondary-color) 0%, var(--accent-color) 100%)`,
            color: 'var(--primary-color)'
          }}
        >
          <FaPlus className="mr-2" /> {designButtonConfig.label}
        </Link>
      )}
      
      {/* Mobile Design Button */}
      {role === 'vendor' ? (
        <button
          onClick={handleDesignButtonClick}
          className="lg:hidden w-12 h-12 rounded-full flex items-center justify-center mt-auto transition-all duration-200 hover:shadow-lg"
          style={{ 
            background: `linear-gradient(135deg, var(--secondary-color) 0%, var(--accent-color) 100%)`,
            color: 'var(--primary-color)'
          }}
        >
          <FaPlus />
          <span className="sr-only">{designButtonConfig.label}</span>
        </button>
      ) : (
        <Link
          href={designButtonConfig.href}
          onClick={handleDesignButtonClick}
          className="lg:hidden w-12 h-12 rounded-full flex items-center justify-center mt-auto transition-all duration-200 hover:shadow-lg"
          style={{ 
            background: `linear-gradient(135deg, var(--secondary-color) 0%, var(--accent-color) 100%)`,
            color: 'var(--primary-color)'
          }}
        >
          <FaPlus />
          <span className="sr-only">{designButtonConfig.label}</span>
        </Link>
      )}
    </div>
  );
};

export default Navigation; 