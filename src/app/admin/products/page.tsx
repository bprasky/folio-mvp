'use client';

import { useState, useEffect } from 'react';
import { FaDownload, FaFilter, FaSort, FaCheck, FaTimes, FaExternalLinkAlt } from 'react-icons/fa';
import { RidgeCard, StatsCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

interface PendingProduct {
  id: string;
  name: string;
  brand: string;
  price: string;
  url: string;
  description: string;
  category: string;
  vendorName: string;
  image: string;
  isPending: boolean;
  taggedBy: string[];
  projectsUsed: string[];
  dateAdded: string;
  totalTags: number;
}

export default function AdminProductsPage() {
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'vendor' | 'tags' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterBy, setFilterBy] = useState<'all' | 'pending' | 'approved'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingProducts();
  }, []);

  const loadPendingProducts = async () => {
    try {
      // Mock data - in real app, this would come from your database
      const mockData: PendingProduct[] = [
        {
          id: '1',
          name: 'West Elm Mid-Century Sofa',
          brand: 'West Elm',
          price: '$1,299',
          url: 'https://westelm.com/mid-century-sofa',
          description: '3-seater sofa with velvet upholstery',
          category: 'Furniture',
          vendorName: 'West Elm',
          image: 'https://source.unsplash.com/random/300x300?sofa',
          isPending: false,
          taggedBy: ['Sarah Chen', 'Mike Johnson'],
          projectsUsed: ['Modern Living Room', 'Downtown Loft'],
          dateAdded: '2024-01-15',
          totalTags: 5
        },
        {
          id: '2',
          name: 'Brass Arc Floor Lamp',
          brand: 'CB2',
          price: '$449',
          url: 'https://cb2.com/brass-arc-lamp',
          description: 'Modern brass floor lamp with marble base',
          category: 'Lighting',
          vendorName: 'CB2',
          image: 'https://source.unsplash.com/random/300x300?lamp',
          isPending: true,
          taggedBy: ['Sarah Chen'],
          projectsUsed: ['Modern Living Room'],
          dateAdded: '2024-01-20',
          totalTags: 2
        },
        {
          id: '3',
          name: 'Moroccan Wool Rug',
          brand: 'Rugs USA',
          price: '$289',
          url: 'https://rugsusa.com/moroccan-wool',
          description: 'Hand-woven wool rug with geometric pattern',
          category: 'Textiles',
          vendorName: 'Rugs USA',
          image: 'https://source.unsplash.com/random/300x300?rug',
          isPending: true,
          taggedBy: ['Sarah Chen', 'Mike Johnson', 'Lisa Wang'],
          projectsUsed: ['Modern Living Room', 'Cozy Apartment', 'Family Home'],
          dateAdded: '2024-01-18',
          totalTags: 8
        }
      ];

      setPendingProducts(mockData);
    } catch (error) {
      console.error('Error loading pending products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllData = async () => {
    try {
      // Generate comprehensive export of all product data
      const headers = [
        'Product Name',
        'Brand',
        'Price',
        'Product URL',
        'Description',
        'Category',
        'Vendor',
        'Status',
        'Total Tags',
        'Tagged By (Designers)',
        'Projects Used In',
        'Date Added'
      ];

      const csvRows = [
        headers.join(','),
        ...getSortedProducts().map(product => [
          `"${product.name}"`,
          `"${product.brand}"`,
          `"${product.price}"`,
          `"${product.url}"`,
          `"${product.description}"`,
          `"${product.category}"`,
          `"${product.vendorName}"`,
          `"${product.isPending ? 'Pending' : 'Approved'}"`,
          `"${product.totalTags}"`,
          `"${product.taggedBy.join('; ')}"`,
          `"${product.projectsUsed.join('; ')}"`,
          `"${product.dateAdded}"`
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const fileName = `Admin_All_Products_Export_${new Date().toISOString().split('T')[0]}.csv`;

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const handleExportVendorReport = async () => {
    try {
      // Generate vendor engagement report
      const vendorStats = pendingProducts.reduce((acc, product) => {
        const vendor = product.vendorName;
        if (!acc[vendor]) {
          acc[vendor] = {
            vendorName: vendor,
            totalProducts: 0,
            totalTags: 0,
            uniqueDesigners: new Set(),
            uniqueProjects: new Set(),
            pendingProducts: 0,
            approvedProducts: 0
          };
        }

        acc[vendor].totalProducts++;
        acc[vendor].totalTags += product.totalTags;
        product.taggedBy.forEach(designer => acc[vendor].uniqueDesigners.add(designer));
        product.projectsUsed.forEach(project => acc[vendor].uniqueProjects.add(project));

        if (product.isPending) {
          acc[vendor].pendingProducts++;
        } else {
          acc[vendor].approvedProducts++;
        }

        return acc;
      }, {} as Record<string, { vendorName: string; totalProducts: number; totalTags: number; uniqueDesigners: Set<string>; uniqueProjects: Set<string>; pendingProducts: number; approvedProducts: number }>);

      const vendorData = Object.values(vendorStats).map((vendor) => ({
        ...vendor,
        uniqueDesigners: vendor.uniqueDesigners.size,
        uniqueProjects: vendor.uniqueProjects.size
      }));

      const headers = [
        'Vendor Name',
        'Total Products',
        'Total Tags',
        'Unique Designers',
        'Unique Projects',
        'Pending Products',
        'Approved Products',
        'Engagement Score'
      ];

      const csvRows = [
        headers.join(','),
        ...vendorData.map((vendor) => [
          `"${vendor.vendorName}"`,
          `"${vendor.totalProducts}"`,
          `"${vendor.totalTags}"`,
          `"${vendor.uniqueDesigners}"`,
          `"${vendor.uniqueProjects}"`,
          `"${vendor.pendingProducts}"`,
          `"${vendor.approvedProducts}"`,
          `"${(vendor.totalTags * vendor.uniqueDesigners).toFixed(1)}"`
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const fileName = `Vendor_Engagement_Report_${new Date().toISOString().split('T')[0]}.csv`;

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export vendor report. Please try again.');
    }
  };

  const getSortedProducts = () => {
    let filtered = pendingProducts;

    if (filterBy !== 'all') {
      filtered = pendingProducts.filter(product =>
        filterBy === 'pending' ? product.isPending : !product.isPending
      );
    }

    return filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'vendor':
          aValue = a.vendorName.toLowerCase();
          bValue = b.vendorName.toLowerCase();
          break;
        case 'tags':
          aValue = a.totalTags;
          bValue = b.totalTags;
          break;
        case 'date':
          aValue = new Date(a.dateAdded).getTime();
          bValue = new Date(b.dateAdded).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleApproveProduct = async (productId: string) => {
    setPendingProducts(prev =>
      prev.map(product =>
        product.id === productId
          ? { ...product, isPending: false }
          : product
      )
    );
  };

  const handleRejectProduct = async (productId: string) => {
    setPendingProducts(prev => prev.filter(product => product.id !== productId));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-canvas py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
              <p className="text-folio-text-secondary">Loading products...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="folio-h1 mb-2">Product Management</h1>
            <p className="folio-body">Manage tagged products and vendor relationships</p>
          </div>
          <div className="flex gap-3">
            <Button variant="ridge" onClick={handleExportVendorReport}>
              <FaDownload className="w-4 h-4 mr-2" />
              Vendor Report
            </Button>
            <Button variant="accent" onClick={handleExportAllData}>
              <FaDownload className="w-4 h-4 mr-2" />
              Export All Data
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatsCard label="Total Products" value={pendingProducts.length} />
          <StatsCard
            label="Pending Approval"
            value={pendingProducts.filter(p => p.isPending).length}
          />
          <StatsCard
            label="Total Tags"
            value={pendingProducts.reduce((sum, p) => sum + p.totalTags, 0)}
          />
          <StatsCard
            label="Unique Vendors"
            value={new Set(pendingProducts.map(p => p.vendorName)).size}
          />
        </div>

        {/* Filters and Sort */}
        <RidgeCard padding="md" className="mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <FaFilter className="text-folio-text-tertiary" />
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as 'all' | 'pending' | 'approved')}
                className="ridge-input px-3 py-2"
              >
                <option value="all">All Products</option>
                <option value="pending">Pending Only</option>
                <option value="approved">Approved Only</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <FaSort className="text-folio-text-tertiary" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'vendor' | 'tags' | 'date')}
                className="ridge-input px-3 py-2"
              >
                <option value="date">Date Added</option>
                <option value="name">Product Name</option>
                <option value="vendor">Vendor</option>
                <option value="tags">Tag Count</option>
              </select>
            </div>
            <Button
              variant="ridge"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
          </div>
        </RidgeCard>

        {/* Products Table */}
        <RidgeCard padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-ground">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {getSortedProducts().map((product) => (
                  <tr key={product.id} className="hover:bg-surface-ground/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-12 w-12 rounded-lg overflow-hidden bg-surface-ground mr-4">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-folio-text-primary">{product.name}</div>
                          <div className="text-sm text-folio-text-secondary">{product.price}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-folio-text-primary">{product.vendorName}</div>
                      <div className="text-sm text-folio-text-secondary">{product.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-folio-text-primary">{product.totalTags} tags</div>
                      <div className="text-sm text-folio-text-secondary">
                        {product.taggedBy.length} designer{product.taggedBy.length !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        product.isPending
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {product.isPending ? 'Pending' : 'Approved'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
                          title="View Product"
                        >
                          <FaExternalLinkAlt className="w-4 h-4" />
                        </a>
                        {product.isPending && (
                          <>
                            <button
                              onClick={() => handleApproveProduct(product.id)}
                              className="text-green-600 hover:text-green-800"
                              title="Approve Product"
                            >
                              <FaCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRejectProduct(product.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Reject Product"
                            >
                              <FaTimes className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RidgeCard>
      </div>
    </div>
  );
}
