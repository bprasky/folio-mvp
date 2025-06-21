import React from 'react';

interface MetricsPanelProps {
  views: number;
  saves: number;
  eventsFeatured: number;
  className?: string;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  views,
  saves,
  eventsFeatured,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Metrics</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{views}</p>
          <p className="text-sm text-gray-600">Views</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{saves}</p>
          <p className="text-sm text-gray-600">Saves</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{eventsFeatured}</p>
          <p className="text-sm text-gray-600">Events Featured</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Engagement Rate</span>
              <span className="text-gray-900 font-medium">
                {((saves / views) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full">
              <div
                className="h-2 bg-blue-600 rounded-full"
                style={{ width: `${(saves / views) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Event Participation</span>
              <span className="text-gray-900 font-medium">
                {((eventsFeatured / views) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full">
              <div
                className="h-2 bg-green-600 rounded-full"
                style={{ width: `${(eventsFeatured / views) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 