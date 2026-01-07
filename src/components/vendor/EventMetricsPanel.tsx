'use client';

interface EventMetric {
  event_name: string;
  views_during_event: number;
  saves_during_event: number;
  qr_scans: number;
  designers_engaged: number;
}

interface EventMetricsPanelProps {
  events: EventMetric[];
}

export default function EventMetricsPanel({ events }: EventMetricsPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Event Performance</h2>
      <div className="space-y-6">
        {events.map((event) => (
          <div key={event.event_name} className="border-b border-gray-200 last:border-0 pb-6 last:pb-0">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{event.event_name}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Views</div>
                <div className="text-2xl font-bold text-blue-900">
                  {event.views_during_event.toLocaleString()}
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Saves</div>
                <div className="text-2xl font-bold text-green-900">
                  {event.saves_during_event.toLocaleString()}
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">QR Scans</div>
                <div className="text-2xl font-bold text-purple-900">
                  {event.qr_scans.toLocaleString()}
                </div>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg">
                <div className="text-sm text-amber-600 font-medium">Designers Engaged</div>
                <div className="text-2xl font-bold text-amber-900">
                  {event.designers_engaged.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 