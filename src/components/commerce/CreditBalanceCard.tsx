'use client';

import { useEffect, useState } from 'react';

interface CreditBalance {
  available: number;
  pending: number;
  lifetime: {
    earned: number;
    redeemed: number;
  };
}

interface CreditBalanceCardProps {
  className?: string;
}

export function CreditBalanceCard({ className = '' }: CreditBalanceCardProps) {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/commerce/credit')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch balance');
        return res.json();
      })
      .then(setBalance)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className={`animate-pulse h-32 bg-gray-100 rounded-lg ${className}`}
      />
    );
  }

  if (error) {
    return (
      <div
        className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}
      >
        <p className="text-sm text-red-600">
          Unable to load credit balance
        </p>
      </div>
    );
  }

  if (!balance) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}
    >
      <h3 className="text-sm font-medium text-gray-500 mb-4">Folio Credit</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-semibold text-gray-900">
            {formatCurrency(balance.available)}
          </p>
          <p className="text-sm text-gray-500">Available</p>
        </div>

        <div>
          <p className="text-2xl font-semibold text-gray-400">
            {formatCurrency(balance.pending)}
          </p>
          <p className="text-sm text-gray-500">Pending</p>
        </div>
      </div>

      {balance.pending > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          Pending credits become available after 30 days
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Lifetime earned</span>
          <span className="text-gray-900">
            {formatCurrency(balance.lifetime.earned)}
          </span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-500">Lifetime redeemed</span>
          <span className="text-gray-900">
            {formatCurrency(balance.lifetime.redeemed)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default CreditBalanceCard;
