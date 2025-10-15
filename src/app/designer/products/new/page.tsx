'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function NewProductPage() {
  const router = useRouter();
  const [form, setForm] = useState({ 
    name: '', 
    sku: '', 
    url: '', 
    vendorName: '', 
    priceCents: '', 
    imageUrl: '' 
  });
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function submit() {
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/designer/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          priceCents: form.priceCents ? Number(form.priceCents) : undefined,
        }),
      });
      const json = await res.json();
      
      if (json?.productId) {
        setCreatedId(json.productId);
        toast.success('Product created successfully!');
      } else {
        toast.error('Failed to create product');
      }
    } catch (error) {
      toast.error('Error creating product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Add Outside Product</h1>
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        {['name', 'sku', 'vendorName', 'url', 'imageUrl', 'priceCents'].map((key) => (
          <div key={key} className="grid gap-1">
            <label className="text-sm font-medium capitalize">
              {key === 'priceCents' ? 'Price (cents)' : key.replace(/([A-Z])/g, ' $1').trim()}
            </label>
            <input
              className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={(form as any)[key] || ''}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              placeholder={
                key === 'priceCents' 
                  ? 'e.g. 12900 for $129.00' 
                  : key === 'name'
                  ? 'Product name (required)'
                  : `Enter ${key.replace(/([A-Z])/g, ' $1').trim()}`
              }
              required={key === 'name'}
            />
          </div>
        ))}
        
        <button 
          onClick={submit} 
          disabled={saving || !form.name.trim()} 
          className="w-full rounded bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Creating Product...' : 'Create Product'}
        </button>
        
        {createdId && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 font-medium">✅ Product created successfully!</p>
            <p className="text-green-600 text-sm">Product ID: {createdId}</p>
            <button
              onClick={() => router.push('/designer')}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              Go to Designer Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
