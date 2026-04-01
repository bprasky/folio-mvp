'use client';

import { useState, useEffect } from 'react';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import type { BudgetSummary } from '@/types/project-actions';
import BulkPricingModal from './BulkPricingModal';

interface Selection {
  id: string;
  productName: string | null;
  vendorName: string | null;
  unitPrice: number | null;
  roomId: string | null;
  room: { id: string; name: string } | null;
  productTagId: string | null;
}

interface PricingEntry {
  id: string;
  productId: string;
  status: string;
  unitPriceTrade: number | null;
  leadTimeWeeks: number | null;
  availability: string | null;
  quotedAt: string | null;
}

interface ActionItemsPanelProps {
  projectId: string;
  projectName: string;
  selections: Selection[];
  onRefresh: () => void;
}

export default function ActionItemsPanel({
  projectId,
  projectName,
  selections,
  onRefresh,
}: ActionItemsPanelProps) {
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [pricing, setPricing] = useState<PricingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    const [budgetRes, pricingRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/budget`),
      fetch(`/api/projects/${projectId}/pricing`),
    ]);

    if (budgetRes.ok) {
      setBudget(await budgetRes.json());
    }
    if (pricingRes.ok) {
      const data = await pricingRes.json();
      setPricing(data.entries || []);
    }
    setLoading(false);
  };

  const pricingMap = new Map(pricing.map(p => [p.productId, p]));
  const pricedCount = pricing.filter(p => p.status === 'RECEIVED').length;
  const pendingCount = pricing.filter(p => p.status === 'REQUESTED').length;
  const totalProducts = selections.length;
  const vendorCount = new Set(selections.map(s => s.vendorName).filter(Boolean)).size;

  // Build needs attention items
  const pendingQuotes = pricing.filter(p => p.status === 'REQUESTED');
  const discontinued = pricing.filter(p => p.availability === 'DISCONTINUED');

  // Build selection items for bulk modal
  const bulkSelections = selections
    .filter(s => s.productName)
    .map(s => {
      const p = s.productTagId ? pricingMap.get(s.productTagId) : undefined;
      const uiMeta = (s as unknown as Record<string, unknown>).uiMeta as Record<string, string> | null;
      const productId = uiMeta?.productId || s.productTagId || s.id;
      return {
        productId,
        productName: s.productName || 'Unknown',
        vendorName: s.vendorName || 'Unknown',
        roomName: s.room?.name || null,
        hasPricing: p?.status === 'RECEIVED',
        currentPrice: p?.unitPriceTrade || null,
      };
    });

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
        <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading action items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="text-sm text-[var(--text-secondary)]">
        {totalProducts} products · {vendorCount} vendors · {pricedCount} priced
        {budget && budget.tradeCost > 0 && (
          <> · ${budget.tradeCost.toLocaleString()} estimated</>
        )}
      </div>

      {/* Bulk Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="accent" size="sm" onClick={() => setBulkModalOpen(true)}>
          Request Pricing
        </Button>
      </div>

      {/* Needs Attention */}
      {(pendingQuotes.length > 0 || discontinued.length > 0) && (
        <RidgeCard padding="lg">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Needs Attention</h3>
          <div className="space-y-2">
            {pendingQuotes.length > 0 && (
              <div className="text-sm text-[var(--text-secondary)]">
                <span className="text-amber-600">⏳</span> {pendingQuotes.length} quote request{pendingQuotes.length !== 1 ? 's' : ''} pending
              </div>
            )}
            {discontinued.length > 0 && (
              <div className="text-sm text-[var(--text-secondary)]">
                <span className="text-red-500">⛔</span> {discontinued.length} product{discontinued.length !== 1 ? 's' : ''} discontinued
              </div>
            )}
          </div>
        </RidgeCard>
      )}

      {/* Budget Summary */}
      {budget && (
        <RidgeCard padding="lg">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Budget Summary</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-[var(--text-tertiary)]">Trade Cost</div>
              <div className="text-lg font-semibold text-[var(--text-primary)]">
                ${budget.tradeCost.toLocaleString()}
              </div>
              <div className="text-xs text-[var(--text-tertiary)]">
                ({budget.pricedCount} of {budget.totalCount} priced)
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-tertiary)]">Client Price</div>
              <div className="text-lg font-semibold text-[var(--text-primary)]">
                ${Math.round(budget.clientPrice).toLocaleString()}
              </div>
              <div className="text-xs text-[var(--text-tertiary)]">
                (at {budget.markupPercent}% markup)
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-tertiary)]">Margin</div>
              <div className="text-lg font-semibold text-green-600">
                ${Math.round(budget.margin).toLocaleString()}
              </div>
            </div>
          </div>

          {/* By Room */}
          {budget.byRoom.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--text-tertiary)] uppercase">By Room</div>
              {budget.byRoom.map(room => (
                <div key={room.roomId} className="flex items-center gap-3">
                  <span className="text-sm text-[var(--text-primary)] w-36 truncate">{room.roomName}</span>
                  <div className="flex-grow h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full transition-all"
                      style={{ width: `${room.percentPriced}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)] w-20 text-right">
                    {room.tradeCost > 0 ? `$${room.tradeCost.toLocaleString()}` : '—'}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)] w-10 text-right">
                    {room.percentPriced}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {budget.totalCount - budget.pricedCount > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setBulkModalOpen(true)}
                className="text-sm text-[var(--accent)] hover:underline"
              >
                {budget.totalCount - budget.pricedCount} products still need pricing →
              </button>
            </div>
          )}
        </RidgeCard>
      )}

      {/* By Vendor */}
      {budget && budget.byVendor.length > 0 && (
        <RidgeCard padding="lg">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">By Vendor</h3>
          <div className="space-y-2">
            {budget.byVendor.map(vendor => (
              <div key={vendor.vendorName} className="flex items-center gap-3 text-sm">
                <span className="text-[var(--text-primary)] flex-grow truncate">{vendor.vendorName}</span>
                <span className="text-[var(--text-tertiary)]">{vendor.productCount} products</span>
                <span className={
                  vendor.status === 'all_priced' ? 'text-green-600' :
                  vendor.status === 'partial' ? 'text-amber-600' :
                  'text-[var(--text-tertiary)]'
                }>
                  {vendor.status === 'all_priced' ? '✓ All priced' :
                   vendor.status === 'partial' ? `⏳ ${vendor.pricedCount} priced` :
                   '✗ Not requested'}
                </span>
                {vendor.tradeCost > 0 && (
                  <span className="text-[var(--text-primary)] font-medium w-24 text-right">
                    ${vendor.tradeCost.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </RidgeCard>
      )}

      {/* Completed */}
      {pricedCount > 0 && (
        <RidgeCard padding="lg">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Completed</h3>
          <div className="text-sm text-[var(--text-secondary)]">
            ✓ {pricedCount} products priced
          </div>
        </RidgeCard>
      )}

      {/* Bulk Pricing Modal */}
      <BulkPricingModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        selections={bulkSelections}
        onSent={(count) => {
          setBulkModalOpen(false);
          loadData();
          onRefresh();
        }}
      />
    </div>
  );
}
