import React, { useState } from 'react';
import clsx from 'clsx';

const eventTypeOptions = [
  { label: "Panel", value: "PANEL" },
  { label: "Product Reveal", value: "PRODUCT_REVEAL" },
  { label: "Happy Hour", value: "HAPPY_HOUR" },
  { label: "Lunch & Learn", value: "LUNCH_AND_LEARN" },
  { label: "Installation", value: "INSTALLATION" },
  { label: "Exhibition", value: "EXHIBITION" },
  { label: "Booth", value: "BOOTH" },
  { label: "Party", value: "PARTY" },
  { label: "Meal", value: "MEAL" },
  { label: "Tour", value: "TOUR" },
  { label: "Awards", value: "AWARDS" },
  { label: "Workshop", value: "WORKSHOP" },
  { label: "Keynote", value: "KEYNOTE" },
  { label: "Other", value: "OTHER" },
];

interface EventTypeFilterProps {
  selectedTypes: string[];
  onTypeChange: (types: string[]) => void;
  className?: string;
}

export default function EventTypeFilter({ selectedTypes, onTypeChange, className }: EventTypeFilterProps) {
  const handleToggle = (type: string) => {
    const newSelectedTypes = selectedTypes.includes(type) 
      ? selectedTypes.filter((t) => t !== type) 
      : [...selectedTypes, type];
    onTypeChange(newSelectedTypes);
  };

  const clearAll = () => {
    onTypeChange([]);
  };

  const selectAll = () => {
    onTypeChange(eventTypeOptions.map(option => option.value));
  };

  return (
    <div className={clsx("mb-6", className)}>
      {/* Header with clear/select all buttons */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filter by Event Type</h3>
        <div className="flex space-x-2">
          <button
            onClick={clearAll}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clear All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={selectAll}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Select All
          </button>
        </div>
      </div>

      {/* Filter Toggle Buttons */}
      <div className="flex flex-wrap gap-2">
        {eventTypeOptions.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handleToggle(value)}
            className={clsx(
              "px-3 py-1 rounded-full text-sm font-medium border transition-all duration-200",
              selectedTypes.includes(value)
                ? "bg-folio-accent text-white border-folio-accent shadow-sm"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:border-gray-400"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active filters count */}
      {selectedTypes.length > 0 && (
        <div className="mt-3 text-sm text-gray-500">
          {selectedTypes.length} of {eventTypeOptions.length} event types selected
        </div>
      )}
    </div>
  );
} 