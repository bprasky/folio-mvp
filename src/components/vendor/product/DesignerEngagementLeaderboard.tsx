'use client';

import Image from 'next/image';
import { FaTrophy } from 'react-icons/fa';

interface DesignerEngagement {
  designer_name: string;
  profile_image: string;
  total_saves: number;
  total_views: number;
  featured_in_events: string[];
}

interface DesignerEngagementLeaderboardProps {
  designers: DesignerEngagement[];
}

export default function DesignerEngagementLeaderboard({ designers }: DesignerEngagementLeaderboardProps) {
  const sortedDesigners = [...designers].sort((a, b) => b.total_saves - a.total_saves);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
        <FaTrophy className="text-amber-500 mr-3" /> Designer Engagement Leaderboard
      </h2>
      <div className="space-y-4">
        {sortedDesigners.length > 0 ? (
          sortedDesigners.map((designer, index) => (
            <div key={designer.designer_name} className="flex items-center p-4 bg-gray-50 rounded-md shadow-sm">
              <span className="text-lg font-bold text-gray-700 mr-4">#{index + 1}</span>
              <Image
                src={designer.profile_image}
                alt={designer.designer_name}
                width={48}
                height={48}
                className="rounded-full mr-4 object-cover"
              />
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">{designer.designer_name}</h3>
                <p className="text-sm text-gray-600">
                  Saves: <span className="font-semibold">{designer.total_saves}</span> | 
                  Views: <span className="font-semibold">{designer.total_views}</span>
                </p>
                {designer.featured_in_events.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Featured in: {designer.featured_in_events.join(', ')}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-600">No designer engagement data available.</p>
        )}
      </div>
    </div>
  );
} 