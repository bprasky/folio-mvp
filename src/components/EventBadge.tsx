'use client';

import { FaFire, FaRocket, FaStar, FaClock } from 'react-icons/fa';

interface EventBadgeProps {
  type: 'new' | 'rising' | 'trending' | 'popular';
  className?: string;
}

const badgeConfig = {
  new: {
    icon: FaClock,
    text: 'New',
    bgColor: 'bg-blue-500',
    textColor: 'text-white',
    borderColor: 'border-blue-600'
  },
  rising: {
    icon: FaRocket,
    text: 'Rising',
    bgColor: 'bg-orange-500',
    textColor: 'text-white',
    borderColor: 'border-orange-600'
  },
  trending: {
    icon: FaFire,
    text: 'Trending',
    bgColor: 'bg-red-500',
    textColor: 'text-white',
    borderColor: 'border-red-600'
  },
  popular: {
    icon: FaStar,
    text: 'Popular',
    bgColor: 'bg-purple-500',
    textColor: 'text-white',
    borderColor: 'border-purple-600'
  }
};

export default function EventBadge({ type, className = '' }: EventBadgeProps) {
  const config = badgeConfig[type];
  const Icon = config.icon;

  return (
    <div className={`
      inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold
      ${config.bgColor} ${config.textColor} ${config.borderColor}
      border shadow-sm backdrop-blur-sm
      ${className}
    `}>
      <Icon className="w-3 h-3" />
      <span>{config.text}</span>
    </div>
  );
} 