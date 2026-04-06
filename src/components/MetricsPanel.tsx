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
      <h3 className="text-lg font-semibold text-folio-text-primary mb-4">Metrics</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-folio-text-primary">{views}</p>
          <p className="text-sm text-folio-text-secondary">Views</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-folio-text-primary">{saves}</p>
          <p className="text-sm text-folio-text-secondary">Saves</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-folio-text-primary">{eventsFeatured}</p>
          <p className="text-sm text-folio-text-secondary">Events Featured</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-folio-text-secondary">Engagement Rate</span>
              <span className="text-folio-text-primary font-medium">
                {((saves / views) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-surface-ground rounded-full">
              <div
                className="h-2 bg-[var(--accent)] rounded-full"
                style={{ width: `${(saves / views) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-folio-text-secondary">Event Participation</span>
              <span className="text-folio-text-primary font-medium">
                {((eventsFeatured / views) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-surface-ground rounded-full">
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