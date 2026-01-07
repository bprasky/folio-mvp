'use client';

import { FaHome } from 'react-icons/fa';

interface FolioLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'text' | 'icon' | 'combined';
  className?: string;
}

export default function FolioLogo({ size = 'md', variant = 'combined', className = '' }: FolioLogoProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const mobileSizeClasses = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3',
  };

  if (variant === 'icon') {
    return (
      <div className={`w-10 h-10 rounded-lg bg-folio-text text-white font-bold text-xl flex items-center justify-center shadow-sm ${className}`}>
        <FaHome className="w-5 h-5" />
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={`font-canela font-normal tracking-[2px] uppercase text-folio-text ${sizeClasses[size]} md:${sizeClasses[size]} ${mobileSizeClasses[size]} ${className}`}>
        FOLIO
      </div>
    );
  }

  // Combined variant (default)
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="w-10 h-10 rounded-lg bg-folio-text text-white font-bold text-xl flex items-center justify-center shadow-sm">
        <FaHome className="w-5 h-5" />
      </div>
      <div className={`font-canela font-normal tracking-[2px] uppercase text-folio-text ${sizeClasses[size]} md:${sizeClasses[size]} ${mobileSizeClasses[size]} hidden md:block`}>
        FOLIO
      </div>
    </div>
  );
} 