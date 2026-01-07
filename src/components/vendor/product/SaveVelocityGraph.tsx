'use client';

import { FaChartLine } from 'react-icons/fa';

interface SaveVelocityGraphProps {
  data: number[]; // Array of saves per day for the last 7 days
}

export default function SaveVelocityGraph({ data }: SaveVelocityGraphProps) {
  const maxSaves = Math.max(...data);

  // Generate labels for the last 7 days (e.g., Day -6, Day -5, ..., Today)
  const getDayLabel = (index: number) => {
    if (index === data.length - 1) return 'Today';
    if (index === data.length - 2) return 'Yesterday';
    return `Day ${index - data.length + 1}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
        <FaChartLine className="text-blue-500 mr-3" /> Save Velocity (Last 7 Days)
      </h2>
      <div className="flex items-end justify-between h-40 mt-4 bg-gray-50 rounded-md p-2">
        {data.map((saves, index) => (
          <div key={index} className="flex flex-col items-center h-full justify-end px-1">
            <div
              className="bg-blue-400 rounded-t-sm w-6"
              style={{
                height: `${(saves / maxSaves) * 100}%`,
              }}
              title={`${saves} saves on ${getDayLabel(index)}`}
            ></div>
            <span className="text-xs text-gray-500 mt-1">{getDayLabel(index).replace('Day ', '')}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-2 px-2">
        {data.map((_, index) => (
          <span key={index}>{data[index]}</span>
        ))}
      </div>
    </div>
  );
} 