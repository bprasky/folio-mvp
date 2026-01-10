'use client';

import { useEffect, useState, useCallback } from 'react';

interface CreditTransaction {
  id: string;
  type: 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUSTMENT';
  amount: string;
  sourceType: string | null;
  description: string | null;
  availableAt: string;
  createdAt: string;
  sourceOrder: { orderNumber: string } | null;
  redemptionOrder: { orderNumber: string } | null;
}

interface CreditTransactionListProps {
  className?: string;
  limit?: number;
}

export function CreditTransactionList({
  className = '',
  limit = 10,
}: CreditTransactionListProps) {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTransactions = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/commerce/credit/transactions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    },
    [limit]
  );

  useEffect(() => {
    fetchTransactions()
      .then((data) => {
        setTransactions(data.transactions);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fetchTransactions]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const data = await fetchTransactions(nextCursor);
      setTransactions((prev) => [...prev, ...data.transactions]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error('Error loading more transactions:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const formatCurrency = (amount: string) => {
    const value = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Math.abs(value));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTransactionLabel = (tx: CreditTransaction) => {
    switch (tx.type) {
      case 'EARN':
        if (tx.sourceType === 'DESIGNER_COMMISSION') return 'Designer commission';
        if (tx.sourceType === 'REP_ATTRIBUTION') return 'Rep attribution';
        if (tx.sourceType === 'BONUS') return 'Bonus';
        if (tx.sourceType === 'ADJUSTMENT') return 'Adjustment credit';
        return 'Credit earned';
      case 'REDEEM':
        return 'Credit redeemed';
      case 'EXPIRE':
        return 'Credit expired';
      case 'ADJUSTMENT':
        return 'Adjustment';
      default:
        return tx.type;
    }
  };

  const getOrderNumber = (tx: CreditTransaction) => {
    if (tx.sourceOrder) return tx.sourceOrder.orderNumber;
    if (tx.redemptionOrder) return tx.redemptionOrder.orderNumber;
    return null;
  };

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-sm text-red-600">Unable to load transactions</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-6 text-center ${className}`}>
        <p className="text-sm text-gray-500">No credit transactions yet</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <ul className="divide-y divide-gray-100">
        {transactions.map((tx) => {
          const amount = parseFloat(tx.amount);
          const isPositive = amount > 0;
          const orderNumber = getOrderNumber(tx);

          return (
            <li key={tx.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {getTransactionLabel(tx)}
                  </p>
                  {tx.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {tx.description}
                    </p>
                  )}
                  {orderNumber && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Order #{orderNumber}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(tx.createdAt)}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p
                    className={`text-sm font-semibold ${
                      isPositive ? 'text-green-600' : 'text-gray-900'
                    }`}
                  >
                    {isPositive ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </p>
                  {tx.type === 'EARN' && new Date(tx.availableAt) > new Date() && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Available {formatDate(tx.availableAt)}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {nextCursor && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}

export default CreditTransactionList;
