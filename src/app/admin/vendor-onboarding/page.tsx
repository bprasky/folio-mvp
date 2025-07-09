"use client";

import React, { useState } from "react";
import { FaTrash, FaPlus, FaUpload, FaCheckCircle } from "react-icons/fa";

interface Product {
  name: string;
  imageUrl: string;
  description: string;
  category: string;
  productUrl: string;
}

export default function VendorOnboardingPage() {
  const [vendorName, setVendorName] = useState("");
  const [vendorUrl, setVendorUrl] = useState("");
  const [vendorDescription, setVendorDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [manualProducts, setManualProducts] = useState<Product[]>([
    { name: "", imageUrl: "", description: "", category: "", productUrl: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Handle logo upload and preview
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Scrape products from Material Bank
  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setScrapeError(null);
    setScrapedProducts([]);
    setSuccess(false);
    setManualProducts([{ name: "", imageUrl: "", description: "", category: "", productUrl: "" }]);

    try {
      const res = await fetch(
        `/api/vendor-onboarding?vendorUrl=${encodeURIComponent(vendorUrl)}&vendorName=${encodeURIComponent(vendorName)}`
      );
      const data = await res.json();
      if (data.success && data.products.length > 0) {
        setScrapedProducts(data.products);
      } else {
        setScrapeError("Scraping failed. Add products manually.");
      }
    } catch (err) {
      setScrapeError("Scraping failed. Add products manually.");
    } finally {
      setLoading(false);
    }
  };

  // Remove a scraped product
  const handleRemoveScrapedProduct = (idx: number) => {
    setScrapedProducts((prev) => prev.filter((_, i) => i !== idx));
  };

  // Edit a scraped product
  const handleEditScrapedProduct = (idx: number, field: keyof Product, value: string) => {
    setScrapedProducts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  // Manual product entry handlers
  const handleManualProductChange = (idx: number, field: keyof Product, value: string) => {
    setManualProducts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  const handleAddManualProduct = () => {
    setManualProducts((prev) => [
      ...prev,
      { name: "", imageUrl: "", description: "", category: "", productUrl: "" },
    ]);
  };

  const handleRemoveManualProduct = (idx: number) => {
    setManualProducts((prev) => prev.filter((_, i) => i !== idx));
  };

  // Upload logo to a public image host (for demo, use base64)
  const uploadLogoAndGetUrl = async (): Promise<string | null> => {
    if (!logoFile) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(logoFile);
    });
  };

  // Save vendor and products
  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    setSuccess(false);
    try {
      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await uploadLogoAndGetUrl();
      }
      const body = {
        vendorName,
        vendorUrl,
        vendorDescription,
        logoUrl,
        scrapedProducts: scrapedProducts.length > 0 ? scrapedProducts : undefined,
        manualProductUrls: scrapedProducts.length === 0 ? manualProducts.filter(p => p.productUrl).map(p => p.productUrl) : undefined,
        manualProducts: scrapedProducts.length === 0 ? manualProducts : undefined,
      };
      const res = await fetch("/api/vendor-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setToast("Vendor and products saved successfully!");
        setVendorName("");
        setVendorUrl("");
        setVendorDescription("");
        setLogoFile(null);
        setLogoPreview(null);
        setScrapedProducts([]);
        setManualProducts([{ name: "", imageUrl: "", description: "", category: "", productUrl: "" }]);
      } else {
        setToast("Failed to save vendor and products.");
      }
    } catch (err) {
      setToast("Failed to save vendor and products.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-folio-background flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl glass-panel p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-folio-text mb-8">Vendor Onboarding</h1>
        <form onSubmit={handleScrape} className="space-y-6">
          <div>
            <label className="block text-folio-text font-medium mb-2">Vendor Name *</label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-folio-muted border border-folio-border rounded-lg text-folio-text focus:outline-none focus:ring-2 focus:ring-folio-accent"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-folio-text font-medium mb-2">Material Bank Vendor URL *</label>
            <input
              type="url"
              className="w-full px-4 py-2 bg-folio-muted border border-folio-border rounded-lg text-folio-text focus:outline-none focus:ring-2 focus:ring-folio-accent"
              value={vendorUrl}
              onChange={(e) => setVendorUrl(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-folio-text font-medium mb-2">Vendor Description</label>
            <textarea
              className="w-full px-4 py-2 bg-folio-muted border border-folio-border rounded-lg text-folio-text focus:outline-none focus:ring-2 focus:ring-folio-accent"
              value={vendorDescription}
              onChange={(e) => setVendorDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <label className="block text-folio-text font-medium mb-2">Vendor Logo</label>
            <div className="flex items-center space-x-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="block"
              />
              {logoPreview && (
                <img src={logoPreview} alt="Logo Preview" className="w-16 h-16 rounded-full object-cover border border-folio-border" />
              )}
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-folio-accent text-white font-semibold py-3 px-6 rounded-lg hover:bg-opacity-90 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50"
            disabled={loading || !vendorName || !vendorUrl}
          >
            {loading ? (
              <span className="animate-spin mr-2 h-5 w-5 border-b-2 border-white rounded-full"></span>
            ) : (
              <FaUpload className="mr-2" />
            )}
            Scrape Products
          </button>
        </form>

        {/* Scraped Products Preview */}
        {scrapedProducts.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold text-folio-text mb-4">Preview Scraped Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scrapedProducts.map((product, idx) => (
                <div key={idx} className="glass-panel p-4 rounded-lg relative">
                  <button
                    className="absolute top-2 right-2 text-folio-accent hover:text-red-600"
                    onClick={() => handleRemoveScrapedProduct(idx)}
                    title="Remove"
                  >
                    <FaTrash />
                  </button>
                  <div className="flex items-center space-x-4 mb-3">
                    {product.imageUrl && (
                      <img src={product.imageUrl} alt={product.name} className="w-16 h-16 object-cover rounded border border-folio-border" />
                    )}
                    <input
                      type="text"
                      className="flex-1 px-2 py-1 bg-folio-muted border border-folio-border rounded text-folio-text"
                      value={product.name}
                      onChange={e => handleEditScrapedProduct(idx, "name", e.target.value)}
                    />
                  </div>
                  <textarea
                    className="w-full px-2 py-1 bg-folio-muted border border-folio-border rounded text-folio-text mb-2"
                    value={product.description}
                    onChange={e => handleEditScrapedProduct(idx, "description", e.target.value)}
                    rows={2}
                  />
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      className="flex-1 px-2 py-1 bg-folio-muted border border-folio-border rounded text-folio-text"
                      value={product.category}
                      onChange={e => handleEditScrapedProduct(idx, "category", e.target.value)}
                      placeholder="Category"
                    />
                    <input
                      type="text"
                      className="flex-1 px-2 py-1 bg-folio-muted border border-folio-border rounded text-folio-text"
                      value={product.productUrl}
                      onChange={e => handleEditScrapedProduct(idx, "productUrl", e.target.value)}
                      placeholder="Product URL"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              className="w-full mt-8 bg-folio-accent text-white font-semibold py-3 px-6 rounded-lg hover:bg-opacity-90 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <span className="animate-spin mr-2 h-5 w-5 border-b-2 border-white rounded-full"></span>
              ) : (
                <FaCheckCircle className="mr-2" />
              )}
              Save Vendor + Products
            </button>
          </div>
        )}

        {/* Fallback Manual Product Entry */}
        {scrapeError && (
          <div className="mt-10">
            <div className="mb-4 text-red-600 font-semibold">{scrapeError}</div>
            <h2 className="text-xl font-bold text-folio-text mb-4">Add Products Manually</h2>
            {manualProducts.map((product, idx) => (
              <div key={idx} className="glass-panel p-4 rounded-lg mb-4 relative">
                {manualProducts.length > 1 && (
                  <button
                    className="absolute top-2 right-2 text-folio-accent hover:text-red-600"
                    onClick={() => handleRemoveManualProduct(idx)}
                    title="Remove"
                  >
                    <FaTrash />
                  </button>
                )}
                <div className="flex flex-col md:flex-row md:space-x-4 mb-2">
                  <input
                    type="text"
                    className="flex-1 px-2 py-1 bg-folio-muted border border-folio-border rounded text-folio-text mb-2 md:mb-0"
                    value={product.name}
                    onChange={e => handleManualProductChange(idx, "name", e.target.value)}
                    placeholder="Product Name"
                  />
                  <input
                    type="text"
                    className="flex-1 px-2 py-1 bg-folio-muted border border-folio-border rounded text-folio-text mb-2 md:mb-0"
                    value={product.imageUrl}
                    onChange={e => handleManualProductChange(idx, "imageUrl", e.target.value)}
                    placeholder="Image URL"
                  />
                </div>
                <textarea
                  className="w-full px-2 py-1 bg-folio-muted border border-folio-border rounded text-folio-text mb-2"
                  value={product.description}
                  onChange={e => handleManualProductChange(idx, "description", e.target.value)}
                  placeholder="Description"
                  rows={2}
                />
                <div className="flex space-x-2">
                  <input
                    type="text"
                    className="flex-1 px-2 py-1 bg-folio-muted border border-folio-border rounded text-folio-text"
                    value={product.category}
                    onChange={e => handleManualProductChange(idx, "category", e.target.value)}
                    placeholder="Category"
                  />
                  <input
                    type="text"
                    className="flex-1 px-2 py-1 bg-folio-muted border border-folio-border rounded text-folio-text"
                    value={product.productUrl}
                    onChange={e => handleManualProductChange(idx, "productUrl", e.target.value)}
                    placeholder="Product Detail URL"
                  />
                </div>
              </div>
            ))}
            <button
              className="w-full mb-6 bg-folio-card text-folio-text font-semibold py-2 px-4 rounded-lg hover:bg-folio-border hover:text-white transition-colors flex items-center justify-center space-x-2"
              onClick={handleAddManualProduct}
              type="button"
            >
              <FaPlus className="mr-2" /> Add Another Product
            </button>
            <button
              className="w-full bg-folio-accent text-white font-semibold py-3 px-6 rounded-lg hover:bg-opacity-90 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
              type="button"
            >
              {saving ? (
                <span className="animate-spin mr-2 h-5 w-5 border-b-2 border-white rounded-full"></span>
              ) : (
                <FaCheckCircle className="mr-2" />
              )}
              Save Vendor + Products
            </button>
          </div>
        )}

        {/* Toast / Success Message */}
        {toast && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-folio-accent text-white px-6 py-3 rounded-lg shadow-lg z-50">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
} 