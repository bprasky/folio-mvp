'use client'

/**
 * ExtractionReviewModal
 * Main review interface for extracted PDF items
 */

import { useState, useCallback } from 'react'
import type { ExtractionResult, ExtractedItem } from '@/lib/pdf'
import { ExtractedItemCard } from './ExtractedItemCard'
import { ItemSection } from './ItemSection'

interface Room {
  id: string
  name: string
  type?: string | null
}

interface Props {
  extractionId: string
  result: ExtractionResult
  rooms: Room[]
  onComplete: () => void
  onCancel: () => void
}

export function ExtractionReviewModal({
  extractionId,
  result,
  rooms,
  onComplete,
  onCancel
}: Props) {
  // Selection state - high/medium pre-checked, low unchecked
  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    result.items.high.forEach(i => initial.add(i.id))
    result.items.medium.forEach(i => initial.add(i.id))
    return initial
  })

  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set())
  const [items, setItems] = useState(result.items)
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || '')
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleItem = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    const allIds = [...items.high, ...items.medium, ...items.low].map(i => i.id)
    setSelected(new Set(allIds))
  }, [items])

  const selectNone = useCallback(() => {
    setSelected(new Set())
  }, [])

  const completeWithAI = useCallback(async (item: ExtractedItem) => {
    setLoadingItems(prev => new Set(prev).add(item.id))
    setError(null)

    try {
      const res = await fetch(`/api/extractions/${extractionId}/complete-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id })
      })

      if (res.ok) {
        const { item: updated } = await res.json()
        setItems(prev => updateItemInResult(prev, updated))
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to complete item')
      }
    } catch (err) {
      console.error('Failed to complete item:', err)
      setError('Failed to complete item with AI')
    } finally {
      setLoadingItems(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }, [extractionId])

  const confirmSelection = useCallback(async () => {
    if (!selectedRoomId) {
      setError('Please select a room')
      return
    }

    if (selected.size === 0) {
      setError('Please select at least one item to import')
      return
    }

    setIsConfirming(true)
    setError(null)

    try {
      const res = await fetch(`/api/extractions/${extractionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedItems: Array.from(selected),
          roomId: selectedRoomId
        })
      })

      if (res.ok) {
        onComplete()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to import items')
      }
    } catch (err) {
      console.error('Failed to confirm selection:', err)
      setError('Failed to import items')
    } finally {
      setIsConfirming(false)
    }
  }, [extractionId, selected, selectedRoomId, onComplete])

  const totalItems = items.high.length + items.medium.length + items.low.length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header with stats */}
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Review Extracted Items</h2>
          <div className="mt-2 flex gap-4 text-sm text-gray-600">
            <span>{result.stats.specificationsFound} specifications</span>
            <span>{result.stats.inspirationImages} inspiration images</span>
            <span>{result.stats.pagesProcessed} pages</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{selected.size} of {totalItems} selected</span>
            <button
              onClick={selectAll}
              className="text-sm text-[var(--accent)] hover:text-blue-800"
            >
              Select all
            </button>
            <button
              onClick={selectNone}
              className="text-sm text-[var(--accent)] hover:text-blue-800"
            >
              Select none
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* High confidence section */}
          {items.high.length > 0 && (
            <ItemSection
              title="Ready to Import"
              subtitle="Complete specifications with all key fields"
              items={items.high}
              selected={selected}
              loadingItems={loadingItems}
              onToggle={toggleItem}
              onCompleteWithAI={completeWithAI}
              defaultExpanded={false}
            />
          )}

          {/* Medium confidence section */}
          {items.medium.length > 0 && (
            <ItemSection
              title="Needs Review"
              subtitle="Partial data extracted - can complete with AI"
              items={items.medium}
              selected={selected}
              loadingItems={loadingItems}
              onToggle={toggleItem}
              onCompleteWithAI={completeWithAI}
              defaultExpanded={true}
            />
          )}

          {/* Low confidence section */}
          {items.low.length > 0 && (
            <ItemSection
              title="Inspiration Images"
              subtitle="No product data - save as search placeholders"
              items={items.low}
              selected={selected}
              loadingItems={loadingItems}
              onToggle={toggleItem}
              onCompleteWithAI={completeWithAI}
              defaultExpanded={false}
              showAsInspiration
            />
          )}

          {totalItems === 0 && (
            <div className="text-center py-12 text-gray-500">
              No items were extracted from this PDF. Try uploading a different file.
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="p-6 border-t bg-gray-50">
          {/* Room selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Import to room
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {rooms.length === 0 ? (
                <option value="">No rooms available</option>
              ) : (
                rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.name} {room.type ? `(${room.type})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex justify-between">
            <button
              onClick={onCancel}
              disabled={isConfirming}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmSelection}
              disabled={isConfirming || selected.size === 0 || !selectedRoomId}
              className="px-6 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isConfirming ? (
                <>
                  <LoadingSpinner />
                  Importing...
                </>
              ) : (
                `Import ${selected.size} Items`
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

/**
 * Helper to update an item in the result structure
 */
function updateItemInResult(
  result: ExtractionResult['items'],
  updatedItem: ExtractedItem
): ExtractionResult['items'] {
  const updateInArray = (arr: ExtractedItem[]): ExtractedItem[] =>
    arr.map(item => item.id === updatedItem.id ? updatedItem : item)

  // Find which confidence level the item is in
  const inHigh = result.high.some(i => i.id === updatedItem.id)
  const inMedium = result.medium.some(i => i.id === updatedItem.id)
  const inLow = result.low.some(i => i.id === updatedItem.id)

  // Remove from old location
  let newResult = {
    high: inHigh ? result.high.filter(i => i.id !== updatedItem.id) : result.high,
    medium: inMedium ? result.medium.filter(i => i.id !== updatedItem.id) : result.medium,
    low: inLow ? result.low.filter(i => i.id !== updatedItem.id) : result.low
  }

  // Add to new location based on updated confidence
  switch (updatedItem.confidence) {
    case 'high':
      newResult.high = [...newResult.high, updatedItem]
      break
    case 'medium':
      newResult.medium = [...newResult.medium, updatedItem]
      break
    case 'low':
      newResult.low = [...newResult.low, updatedItem]
      break
  }

  return newResult
}
