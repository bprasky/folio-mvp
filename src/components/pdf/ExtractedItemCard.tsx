'use client'

/**
 * ExtractedItemCard
 * Individual item display with selection and AI completion actions
 */

import { useState } from 'react'
import type { ExtractedItem } from '@/lib/pdf'

interface Props {
  item: ExtractedItem
  selected: boolean
  loading: boolean
  onToggle: () => void
  onCompleteWithAI: () => void
  showAsInspiration?: boolean
}

export function ExtractedItemCard({
  item,
  selected,
  loading,
  onToggle,
  onCompleteWithAI,
  showAsInspiration = false
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const hasImage = !!item.imageData
  const isSpecification = item.type === 'specification'

  return (
    <div
      className={`
        border rounded-lg p-4 transition-all
        ${selected ? 'border-stone-400 bg-stone-50' : 'border-[var(--ridge-outer)]'}
        ${loading ? 'opacity-60' : ''}
      `}
    >
      <div className="flex gap-4">

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={loading}
          className="mt-1 h-5 w-5 rounded border-[var(--ridge-outer)] text-stone-600 focus:ring-stone-500"
        />

        {/* Image thumbnail */}
        {hasImage && (
          <div className="w-24 h-24 flex-shrink-0 rounded overflow-hidden bg-[var(--bg-elevated)]">
            <img
              src={`data:image/png;base64,${item.imageData}`}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* Title line */}
          <div className="flex items-start justify-between gap-2">
            <div>
              {isSpecification && !showAsInspiration ? (
                <>
                  <p className="font-medium text-[var(--text-primary)]">
                    {item.productName || 'Unknown Product'}
                  </p>
                  {item.brand && (
                    <p className="text-sm text-[var(--text-secondary)]">{item.brand}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-medium text-[var(--text-primary)]">Inspiration Image</p>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                    {item.searchQuery || item.description || 'No description'}
                  </p>
                </>
              )}
            </div>

            {/* Price badge */}
            {item.price && (
              <span className="text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
                ${(item.price / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {/* Extracted fields */}
          {isSpecification && !showAsInspiration && (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.dimensions && (
                <FieldBadge label="Dimensions" filled />
              )}
              {item.material && (
                <FieldBadge label="Material" filled />
              )}
              {item.sku && (
                <FieldBadge label="SKU" filled />
              )}
              {item.productUrl && (
                <FieldBadge label="URL" filled />
              )}
              {item.missingFields.map(field => (
                <FieldBadge key={field} label={formatFieldName(field)} filled={false} />
              ))}
            </div>
          )}

          {/* Confidence indicator */}
          <div className="mt-2">
            <ConfidenceBadge confidence={item.confidence} />
            <span className="ml-2 text-xs text-[var(--text-secondary)]">
              Page {item.page}
            </span>
          </div>

          {/* Actions */}
          <div className="mt-3 flex gap-2 items-center">
            {isSpecification && item.missingFields.length > 0 && !showAsInspiration && (
              <button
                onClick={onCompleteWithAI}
                disabled={loading}
                className="text-sm text-[var(--accent)] hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <LoadingSpinner className="w-3 h-3" />
                    Searching...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-3 h-3" />
                    Complete with AI
                  </>
                )}
              </button>
            )}

            {showAsInspiration && (
              <span className="text-sm text-[var(--text-secondary)]">
                Will save as searchable placeholder
              </span>
            )}

            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] ml-auto"
            >
              {expanded ? 'Less' : 'Details'}
            </button>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <ItemDetails item={item} />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function FieldBadge({ label, filled }: { label: string; filled: boolean }) {
  return (
    <span
      className={`
        text-xs px-2 py-0.5 rounded
        ${filled
          ? 'bg-green-100 text-green-700'
          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
        }
      `}
    >
      {label}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence: ExtractedItem['confidence'] }) {
  const styles = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
  }

  const labels = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Low confidence'
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${styles[confidence]}`}>
      {labels[confidence]}
    </span>
  )
}

function ItemDetails({ item }: { item: ExtractedItem }) {
  return (
    <>
      {item.brand && (
        <DetailRow label="Brand" value={item.brand} />
      )}
      {item.productName && (
        <DetailRow label="Product" value={item.productName} />
      )}
      {item.sku && (
        <DetailRow label="SKU" value={item.sku} />
      )}
      {item.material && (
        <DetailRow label="Material" value={item.material} />
      )}
      {item.finish && (
        <DetailRow label="Finish" value={item.finish} />
      )}
      {item.dimensions && (
        <DetailRow
          label="Dimensions"
          value={formatDimensions(item.dimensions)}
        />
      )}
      {item.productUrl && (
        <DetailRow
          label="URL"
          value={
            <a
              href={item.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline truncate block max-w-xs"
            >
              {item.productUrl}
            </a>
          }
        />
      )}
      {item.sourceText.length > 0 && (
        <div className="text-xs">
          <span className="font-medium text-[var(--text-secondary)]">Source text:</span>
          <pre className="mt-1 p-2 bg-[var(--bg-elevated)] rounded text-[var(--text-secondary)] whitespace-pre-wrap text-xs">
            {item.sourceText.join('\n')}
          </pre>
        </div>
      )}
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex text-sm">
      <span className="font-medium text-[var(--text-secondary)] w-24 flex-shrink-0">{label}:</span>
      <span className="text-[var(--text-primary)]">{value}</span>
    </div>
  )
}

function formatFieldName(field: string): string {
  const map: Record<string, string> = {
    productName: 'Name',
    brand: 'Brand',
    price: 'Price',
    sku: 'SKU',
    dimensions: 'Dimensions',
    material: 'Material',
    productUrl: 'URL'
  }
  return map[field] || field
}

function formatDimensions(dimensions: ExtractedItem['dimensions']): string {
  if (!dimensions) return '-'

  const parts: string[] = []
  if (dimensions.width) parts.push(`${dimensions.width}"W`)
  if (dimensions.depth) parts.push(`${dimensions.depth}"D`)
  if (dimensions.height) parts.push(`${dimensions.height}"H`)
  if (dimensions.length) parts.push(`${dimensions.length}"L`)
  if (dimensions.diameter) parts.push(`${dimensions.diameter}" Diam`)

  return parts.join(' x ') || '-'
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
    </svg>
  )
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
