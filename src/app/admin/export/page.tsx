'use client';

import { useState, useEffect } from 'react';
import { useRole } from '@/contexts/RoleContext';
import { FaFilter, FaSearch, FaFileExcel } from 'react-icons/fa';
import { RidgeCard, StatsCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminExportDashboard() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [exportData, setExportData] = useState<Record<string, unknown>[]>([]);
  const [filteredData, setFilteredData] = useState<Record<string, unknown>[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    designer: '',
    vendor: '',
    room: '',
    status: ''
  });

  useEffect(() => {
    if (role !== 'admin') {
      window.location.href = '/';
      return;
    }
    loadExportData();
  }, [role]);

  useEffect(() => {
    applyFilters();
  }, [exportData, filters]);

  const loadExportData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/export-all-tagged-products');

      if (!response.ok) {
        throw new Error('Failed to load export data');
      }

      const data = await response.json();
      setExportData(data.products || []);
    } catch (error) {
      console.error('Error loading export data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...exportData];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(item =>
        (item.productName as string)?.toLowerCase().includes(searchLower) ||
        (item.project as string)?.toLowerCase().includes(searchLower) ||
        (item.vendorName as string)?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.designer) {
      filtered = filtered.filter(item => item.designerId === filters.designer);
    }

    if (filters.vendor) {
      filtered = filtered.filter(item =>
        (item.vendorName as string)?.toLowerCase().includes(filters.vendor.toLowerCase())
      );
    }

    if (filters.room) {
      filtered = filtered.filter(item =>
        (item.room as string)?.toLowerCase().includes(filters.room.toLowerCase())
      );
    }

    if (filters.status) {
      const isPending = filters.status === 'pending';
      filtered = filtered.filter(item => item.isPending === isPending);
    }

    setFilteredData(filtered);
  };

  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      alert('No data to export. Please adjust your filters.');
      return;
    }

    const headers = [
      'Project Name', 'Client', 'Designer', 'Room', 'Product Name', 'Brand',
      'Price', 'URL', 'Category', 'Vendor', 'Status', 'Date Tagged'
    ];

    const csvRows = [
      headers.join(','),
      ...filteredData.map(row => [
        `"${row.project || ''}"`,
        `"${row.client || ''}"`,
        `"${row.designer || ''}"`,
        `"${row.room || ''}"`,
        `"${row.productName || ''}"`,
        `"${row.brand || ''}"`,
        `"${row.productPrice || ''}"`,
        `"${row.productUrl || ''}"`,
        `"${row.category || ''}"`,
        `"${row.vendorName || ''}"`,
        `"${row.isPending ? 'Pending' : 'Approved'}"`,
        `"${row.dateTagged || ''}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getUniqueValues = (field: string) => {
    const values = exportData
      .map(item => item[field] as string)
      .filter(value => value && value !== '')
      .filter((value, index, self) => self.indexOf(value) === index);
    return values.sort();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-canvas py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
              <h2 className="folio-h2 mb-2">Loading Export Data</h2>
              <p className="folio-body">Loading export data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="folio-h1 mb-2">Export Dashboard</h1>
          <p className="folio-body">Comprehensive export and analysis of all tagged products</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatsCard label="Total Products" value={exportData.length} />
          <StatsCard label="Filtered Results" value={filteredData.length} />
          <StatsCard
            label="Pending Approval"
            value={exportData.filter(p => p.isPending).length}
          />
          <StatsCard
            label="Unique Vendors"
            value={getUniqueValues('vendorName').length}
          />
        </div>

        {/* Filters */}
        <RidgeCard padding="md" className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FaFilter className="text-folio-text-tertiary" />
            <h2 className="folio-h3">Filters & Search</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block folio-meta mb-1">Search</label>
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-folio-text-tertiary" />
                <Input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="pl-10"
                  placeholder="Search products..."
                />
              </div>
            </div>

            <div>
              <label className="block folio-meta mb-1">Designer</label>
              <select
                value={filters.designer}
                onChange={(e) => setFilters({...filters, designer: e.target.value})}
                className="ridge-input w-full px-3 py-2"
              >
                <option value="">All Designers</option>
                {getUniqueValues('designerId').map(designer => (
                  <option key={designer} value={designer}>{designer}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block folio-meta mb-1">Vendor</label>
              <select
                value={filters.vendor}
                onChange={(e) => setFilters({...filters, vendor: e.target.value})}
                className="ridge-input w-full px-3 py-2"
              >
                <option value="">All Vendors</option>
                {getUniqueValues('vendorName').map(vendor => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block folio-meta mb-1">Room</label>
              <select
                value={filters.room}
                onChange={(e) => setFilters({...filters, room: e.target.value})}
                className="ridge-input w-full px-3 py-2"
              >
                <option value="">All Rooms</option>
                {getUniqueValues('room').map(room => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block folio-meta mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="ridge-input w-full px-3 py-2"
              >
                <option value="">All Status</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </RidgeCard>

        {/* Export Actions */}
        <RidgeCard padding="md" className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="folio-h3 mb-2">Export Actions</h2>
              <p className="folio-meta">
                Export {filteredData.length} filtered products
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="accent" onClick={handleExportCSV}>
                <FaFileExcel className="mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </RidgeCard>

        {/* Products Preview Table */}
        <RidgeCard padding="none" className="overflow-hidden">
          <div className="p-6 border-b border-[var(--border-subtle)]">
            <h2 className="folio-h3">Tagged Products Preview ({filteredData.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border-subtle)]">
              <thead className="bg-surface-ground">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">Room</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-surface-canvas divide-y divide-[var(--border-subtle)]">
                {filteredData.slice(0, 50).map((product, index) => (
                  <tr key={index} className="hover:bg-surface-ground/50">
                    <td className="px-6 py-4 text-sm text-folio-text-primary">{product.project as string}</td>
                    <td className="px-6 py-4 text-sm text-folio-text-primary">{product.productName as string}</td>
                    <td className="px-6 py-4 text-sm text-folio-text-primary">{product.vendorName as string}</td>
                    <td className="px-6 py-4 text-sm text-folio-text-primary">{product.room as string}</td>
                    <td className="px-6 py-4 text-sm text-folio-text-primary">${product.productPrice as string}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        product.isPending
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {product.isPending ? 'Pending' : 'Approved'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredData.length > 50 && (
              <div className="p-4 text-center text-folio-text-secondary folio-meta">
                Showing first 50 results. Export CSV to see all {filteredData.length} products.
              </div>
            )}
          </div>
        </RidgeCard>
      </div>
    </div>
  );
}
