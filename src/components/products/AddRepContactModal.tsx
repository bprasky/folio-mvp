'use client';

import { useState } from 'react';
import { FaTimes, FaSpinner, FaUser, FaEnvelope, FaPhone, FaPercent } from 'react-icons/fa';

interface AddRepContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName: string;
  onSuccess: (contact: any) => void;
}

export default function AddRepContactModal({
  isOpen,
  onClose,
  vendorName,
  onSuccess,
}: AddRepContactModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    repName: '',
    repEmail: '',
    repPhone: '',
    repTitle: '',
    preferredContact: 'email',
    notes: '',
    hasTradeAccount: false,
    tradeAccountNumber: '',
    tradeDiscount: '',
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.repName.trim()) {
      setError('Rep name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/rep-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName,
          repName: formData.repName.trim(),
          repEmail: formData.repEmail.trim() || null,
          repPhone: formData.repPhone.trim() || null,
          repTitle: formData.repTitle.trim() || null,
          preferredContact: formData.preferredContact,
          notes: formData.notes.trim() || null,
          hasTradeAccount: formData.hasTradeAccount,
          tradeAccountNumber: formData.tradeAccountNumber.trim() || null,
          tradeDiscount: formData.tradeDiscount ? parseFloat(formData.tradeDiscount) : null,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to save rep contact');
      }

      const result = await response.json();
      onSuccess(result.contact);
      onClose();

      // Reset form
      setFormData({
        repName: '',
        repEmail: '',
        repPhone: '',
        repTitle: '',
        preferredContact: 'email',
        notes: '',
        hasTradeAccount: false,
        tradeAccountNumber: '',
        tradeDiscount: '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save rep contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-canvas rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-folio-text-primary">
            Add Rep Contact
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-folio-text-tertiary hover:text-folio-text-secondary"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Vendor Name (read-only) */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1">
              Vendor / Brand
            </label>
            <input
              type="text"
              value={vendorName}
              disabled
              className="w-full border border-folio-border-subtle bg-surface-ground rounded-md px-3 py-2 text-folio-text-secondary"
            />
          </div>

          {/* Rep Name */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1">
              Rep Name *
            </label>
            <div className="relative">
              <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-folio-text-tertiary w-4 h-4" />
              <input
                type="text"
                value={formData.repName}
                onChange={(e) => handleInputChange('repName', e.target.value)}
                placeholder="John Smith"
                required
                className="w-full border border-folio-border-subtle rounded-md pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Rep Title */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.repTitle}
              onChange={(e) => handleInputChange('repTitle', e.target.value)}
              placeholder="Territory Sales Rep"
              className="w-full border border-folio-border-subtle rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1">
              Email
            </label>
            <div className="relative">
              <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-folio-text-tertiary w-4 h-4" />
              <input
                type="email"
                value={formData.repEmail}
                onChange={(e) => handleInputChange('repEmail', e.target.value)}
                placeholder="john@vendor.com"
                className="w-full border border-folio-border-subtle rounded-md pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1">
              Phone
            </label>
            <div className="relative">
              <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-folio-text-tertiary w-4 h-4" />
              <input
                type="tel"
                value={formData.repPhone}
                onChange={(e) => handleInputChange('repPhone', e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full border border-folio-border-subtle rounded-md pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Preferred Contact */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1">
              Preferred Contact Method
            </label>
            <select
              value={formData.preferredContact}
              onChange={(e) => handleInputChange('preferredContact', e.target.value)}
              className="w-full border border-folio-border-subtle rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="text">Text</option>
            </select>
          </div>

          {/* Trade Account Section */}
          <div className="border-t pt-4 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasTradeAccount}
                onChange={(e) => handleInputChange('hasTradeAccount', e.target.checked)}
                className="w-4 h-4 text-amber-600 border-folio-border-subtle rounded focus:ring-amber-500"
              />
              <span className="text-sm font-medium text-folio-text-primary">
                I have a trade account with this vendor
              </span>
            </label>

            {formData.hasTradeAccount && (
              <div className="mt-3 space-y-3 pl-6">
                <div>
                  <label className="block text-sm text-folio-text-secondary mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.tradeAccountNumber}
                    onChange={(e) => handleInputChange('tradeAccountNumber', e.target.value)}
                    placeholder="TA-123456"
                    className="w-full border border-folio-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-folio-text-secondary mb-1">
                    Trade Discount (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.tradeDiscount}
                      onChange={(e) => handleInputChange('tradeDiscount', e.target.value)}
                      placeholder="40"
                      className="w-full border border-folio-border-subtle rounded-md px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <FaPercent className="absolute right-3 top-1/2 -translate-y-1/2 text-folio-text-tertiary w-3 h-3" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-folio-text-primary mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any notes about this rep or your relationship..."
              rows={2}
              className="w-full border border-folio-border-subtle rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-folio-border-subtle text-folio-text-primary rounded-md hover:bg-surface-ground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Contact'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
