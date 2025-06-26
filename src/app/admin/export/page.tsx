'use client';

import { useState, useEffect } from 'react';
import { useRole } from '@/contexts/RoleContext';
import Navigation from '@/components/Navigation';
import { FaDownload, FaFilePdf, FaFileExcel, FaFilter, FaSearch } from 'react-icons/fa';

export default function AdminExportDashboard() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [exportData, setExportData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
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
        item.productName?.toLowerCase().includes(searchLower) ||
        item.project?.toLowerCase().includes(searchLower) ||
        item.vendorName?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.designer) {
      filtered = filtered.filter(item => item.designerId === filters.designer);
    }

    if (filters.vendor) {
      filtered = filtered.filter(item => 
        item.vendorName?.toLowerCase().includes(filters.vendor.toLowerCase())
      );
    }

    if (filters.room) {
      filtered = filtered.filter(item => 
        item.room?.toLowerCase().includes(filters.room.toLowerCase())
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
        `"${row.projectClient || ''}"`,
        `"${row.designerId || ''}"`,
        `"${row.room || ''}"`,
        `"${row.productName || ''}"`,
        `"${row.productBrand || ''}"`,
        `"${row.productPrice || ''}"`,
        `"${row.productUrl || ''}"`,
        `"${row.productCategory || ''}"`,
        `"${row.vendorName || ''}"`,
        `"${row.isPending ? 'Pending' : 'Approved'}"`,
        `"${row.dateTagged || ''}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const fileName = `Admin_Tagged_Products_Export_${new Date().toISOString().split('T')[0]}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getUniqueValues = (field: string) => {
    return Array.from(new Set(exportData.map(item => item[field]).filter(Boolean)));
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading export data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56 overflow-y-auto">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Export Dashboard</h1>
            <p className="text-gray-600">Comprehensive export and analysis of all tagged products</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500">Total Products</h3>
              <p className="text-2xl font-bold text-gray-900">{exportData.length}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500">Filtered Results</h3>
              <p className="text-2xl font-bold text-blue-600">{filteredData.length}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500">Pending Approval</h3>
              <p className="text-2xl font-bold text-amber-600">
                {exportData.filter(p => p.isPending).length}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500">Unique Vendors</h3>
              <p className="text-2xl font-bold text-green-600">
                {getUniqueValues('vendorName').length}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FaFilter className="text-gray-500" />
              <h2 className="text-lg font-semibold">Filters & Search</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    placeholder="Search products..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designer</label>
                <select
                  value={filters.designer}
                  onChange={(e) => setFilters({...filters, designer: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="">All Designers</option>
                  {getUniqueValues('designerId').map(designer => (
                    <option key={designer} value={designer}>{designer}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <select
                  value={filters.vendor}
                  onChange={(e) => setFilters({...filters, vendor: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="">All Vendors</option>
                  {getUniqueValues('vendorName').map(vendor => (
                    <option key={vendor} value={vendor}>{vendor}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                <select
                  value={filters.room}
                  onChange={(e) => setFilters({...filters, room: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="">All Rooms</option>
                  {getUniqueValues('room').map(room => (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                >
                  <option value="">All Status</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-2">Export Actions</h2>
                <p className="text-sm text-gray-600">
                  Export {filteredData.length} filtered products
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FaFileExcel />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Products Preview Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Tagged Products Preview ({filteredData.length})</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.slice(0, 50).map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{product.project}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{product.productName}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{product.vendorName}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{product.room}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">${product.productPrice}</td>
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
                <div className="p-4 text-center text-gray-500 text-sm">
                  Showing first 50 results. Export CSV to see all {filteredData.length} products.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 