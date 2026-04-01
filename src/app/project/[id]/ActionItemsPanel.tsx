'use client';

import { useState, useEffect, useMemo } from 'react';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import type { BudgetSummary } from '@/types/project-actions';
import BulkPricingModal from './BulkPricingModal';
import BatchRequestModal from './BatchRequestModal';

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
  targetInstallDate: string | null;
  selections: Selection[];
}

export default function ActionItemsPanel({
  projectId,
  projectName,
  targetInstallDate,
  selections,
}: ActionItemsPanelProps) {
  const [installDate, setInstallDate] = useState(targetInstallDate);
  const [editingInstallDate, setEditingInstallDate] = useState(false);
  const [installDateInput, setInstallDateInput] = useState(
    targetInstallDate ? new Date(targetInstallDate).toISOString().split('T')[0] : ''
  );
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [pricing, setPricing] = useState<PricingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [leadTimeModalOpen, setLeadTimeModalOpen] = useState(false);
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);

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

  // Procurement Timeline computation
  const timelineBuckets = useMemo(() => {
    if (!installDate) return null;
    const install = new Date(installDate);
    const now = new Date();

    // Group products with lead times by order deadline
    const withLeadTime: Array<{
      productName: string;
      vendorName: string;
      leadTimeWeeks: number;
      orderBy: Date;
    }> = [];

    const missingLeadTime: string[] = [];

    for (const p of pricing) {
      const sel = selections.find(s => {
        const uiMeta = (s as unknown as Record<string, unknown>).uiMeta as Record<string, string> | null;
        return (uiMeta?.productId || s.productTagId || s.id) === p.productId;
      });
      const productName = sel?.productName || 'Unknown';
      const vendorName = sel?.vendorName || 'Unknown';

      if (p.leadTimeWeeks && p.leadTimeWeeks > 0) {
        const orderBy = new Date(install.getTime() - p.leadTimeWeeks * 7 * 24 * 60 * 60 * 1000);
        withLeadTime.push({ productName, vendorName, leadTimeWeeks: p.leadTimeWeeks, orderBy });
      } else if (p.status === 'RECEIVED') {
        missingLeadTime.push(productName);
      }
    }

    // Also count selections without any pricing entry as missing
    for (const s of selections) {
      const uiMeta = (s as unknown as Record<string, unknown>).uiMeta as Record<string, string> | null;
      const productId = uiMeta?.productId || s.productTagId || s.id;
      if (!pricing.find(p => p.productId === productId)) {
        missingLeadTime.push(s.productName || 'Unknown');
      }
    }

    // Sort by order deadline (soonest first)
    withLeadTime.sort((a, b) => a.orderBy.getTime() - b.orderBy.getTime());

    // Group into monthly buckets
    const buckets = new Map<string, typeof withLeadTime>();
    for (const item of withLeadTime) {
      const monthKey = item.orderBy.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!buckets.has(monthKey)) buckets.set(monthKey, []);
      buckets.get(monthKey)!.push(item);
    }

    // Find items approaching deadline (within 4 weeks)
    const fourWeeksFromNow = new Date(now.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
    const approaching = withLeadTime.filter(item => item.orderBy <= fourWeeksFromNow && item.orderBy >= now);

    return {
      buckets: Array.from(buckets.entries()),
      missingCount: missingLeadTime.length,
      approaching,
      installDateFormatted: install.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  }, [installDate, pricing, selections]);

  const saveInstallDate = async () => {
    if (!installDateInput) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetInstallDate: installDateInput }),
      });
      if (res.ok) {
        setInstallDate(new Date(installDateInput).toISOString());
        setEditingInstallDate(false);
      }
    } catch { /* silently handle */ }
  };

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
        <Button variant="ridge" size="sm" onClick={() => setLeadTimeModalOpen(true)}>
          Request Lead Times
        </Button>
        <Button variant="ridge" size="sm" onClick={() => setAvailabilityModalOpen(true)}>
          Check Availability
        </Button>
      </div>

      {/* Needs Attention */}
      {(pendingQuotes.length > 0 || discontinued.length > 0 || (timelineBuckets?.approaching.length || 0) > 0) && (
        <RidgeCard padding="lg">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Needs Attention</h3>
          <div className="space-y-2">
            {timelineBuckets && timelineBuckets.approaching.length > 0 && (
              <div className="text-sm text-[var(--text-secondary)]">
                <span className="text-red-500">⚠</span> {timelineBuckets.approaching.length} item{timelineBuckets.approaching.length !== 1 ? 's' : ''} need to be ordered within 4 weeks to meet timeline
                {timelineBuckets.approaching.map((item, i) => (
                  <div key={i} className="ml-5 text-xs text-[var(--text-tertiary)]">
                    {item.productName} ({item.vendorName}) · {item.leadTimeWeeks} wk lead
                  </div>
                ))}
              </div>
            )}
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

      {/* Procurement Timeline */}
      <RidgeCard padding="lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Procurement Timeline</h3>
          {!editingInstallDate && (
            <button
              onClick={() => setEditingInstallDate(true)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              {installDate ? 'Change' : 'Set install date'}
            </button>
          )}
        </div>

        {editingInstallDate && (
          <div className="flex items-center gap-2 mb-4">
            <input
              type="date"
              value={installDateInput}
              onChange={(e) => setInstallDateInput(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white border border-[#E8E6E3] rounded-lg text-[#2C2925]"
            />
            <Button variant="accent" size="sm" onClick={saveInstallDate}>Save</Button>
            <Button variant="ridge" size="sm" onClick={() => setEditingInstallDate(false)}>Cancel</Button>
          </div>
        )}

        {!installDate ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            Set a target install date to see backward-scheduled order deadlines.
          </p>
        ) : timelineBuckets ? (
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              Target install: {timelineBuckets.installDateFormatted}
            </p>

            {timelineBuckets.buckets.length > 0 ? (
              timelineBuckets.buckets.map(([monthLabel, items]) => (
                <div key={monthLabel}>
                  <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    Order by {monthLabel}
                  </div>
                  {items.map((item, i) => (
                    <div key={i} className="ml-4 text-xs text-[var(--text-secondary)] py-0.5">
                      {item.productName} ({item.vendorName}) · {item.leadTimeWeeks} wk
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">
                No products with lead time data yet.
              </p>
            )}

            {timelineBuckets.missingCount > 0 && (
              <div className="text-sm text-[var(--text-secondary)] mt-2">
                ❓ {timelineBuckets.missingCount} item{timelineBuckets.missingCount !== 1 ? 's' : ''} missing lead time data
                <button
                  onClick={() => setLeadTimeModalOpen(true)}
                  className="ml-2 text-[var(--accent)] hover:underline"
                >
                  Request Lead Times
                </button>
              </div>
            )}
          </div>
        ) : null}
      </RidgeCard>

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
        onSent={() => {
          setBulkModalOpen(false);
          loadData();
        }}
      />

      <BatchRequestModal
        isOpen={leadTimeModalOpen}
        onClose={() => setLeadTimeModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        selections={bulkSelections.map(s => ({
          productId: s.productId,
          productName: s.productName,
          vendorName: s.vendorName,
          roomName: s.roomName,
        }))}
        requestType="lead-time"
        onSent={() => {
          setLeadTimeModalOpen(false);
          loadData();
        }}
      />

      <BatchRequestModal
        isOpen={availabilityModalOpen}
        onClose={() => setAvailabilityModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        selections={bulkSelections.map(s => ({
          productId: s.productId,
          productName: s.productName,
          vendorName: s.vendorName,
          roomName: s.roomName,
        }))}
        requestType="availability"
        onSent={() => {
          setAvailabilityModalOpen(false);
          loadData();
        }}
      />
    </div>
  );
}
