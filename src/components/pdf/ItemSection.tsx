'use client'

/**
 * ItemSection
 * Collapsible section for grouping extracted items by confidence level
 */

import { useState } from 'react'
import type { ExtractedItem } from '@/lib/pdf'
import { ExtractedItemCard } from './ExtractedItemCard'

interface Props {
  title: string
  subtitle: string
  items: ExtractedItem[]
  selected: Set<string>
  loadingItems: Set<string>
  onToggle: (id: string) => void
  onCompleteWithAI: (item: ExtractedItem) => void
  defaultExpanded?: boolean
  showAsInspiration?: boolean
}

export function ItemSection({
  title,
  subtitle,
  items,
  selected,
  loadingItems,
  onToggle,
  onCompleteWithAI,
  defaultExpanded = false,
  showAsInspiration = false
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const selectedCount = items.filter(i => selected.has(i.id)).length

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{title}</h3>
            <span className="text-sm text-gray-500">
              ({selectedCount}/{items.length} selected)
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
        </div>
        <ChevronIcon expanded={expanded} />
      </button>

      {/* Section content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {items.map(item => (
            <ExtractedItemCard
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              loading={loadingItems.has(item.id)}
              onToggle={() => onToggle(item.id)}
              onCompleteWithAI={() => onCompleteWithAI(item)}
              showAsInspiration={showAsInspiration}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
