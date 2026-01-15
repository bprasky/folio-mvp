'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FaChartBar, FaCamera, FaTag,
  FaPalette, FaStickyNote, FaFilter, FaDownload, FaEye
} from 'react-icons/fa';
import { RidgeCard, StatsCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Selection {
  id: string;
  photo: string | null;
  vendorName: string | null;
  productName: string | null;
  colorFinish: string | null;
  notes: string | null;
  phaseOfUse: string | null;
  gpsLocation: string | null;
  source: string;
  timestamp: string;
  createdAt: string;
  room: {
    name: string;
    project: {
      name: string;
      category: string;
      designer: {
        name: string;
        email: string;
      };
    };
  };
}

export default function VendorAnalyticsPage() {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    vendorName: '',
    phaseOfUse: '',
    source: '',
    projectType: ''
  });

  useEffect(() => {
    fetchSelections();
  }, []);

  const fetchSelections = async () => {
    try {
      const response = await fetch('/api/admin/vendor-analytics');
      if (response.ok) {
        const data = await response.json();
        setSelections(data);
      } else {
        console.error('Failed to fetch selections');
      }
    } catch (error) {
      console.error('Error fetching selections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredSelections = () => {
    return selections.filter(selection => {
      if (filters.vendorName && !selection.vendorName?.toLowerCase().includes(filters.vendorName.toLowerCase())) {
        return false;
      }
      if (filters.phaseOfUse && selection.phaseOfUse !== filters.phaseOfUse) {
        return false;
      }
      if (filters.source && selection.source !== filters.source) {
        return false;
      }
      if (filters.projectType && selection.room.project.category !== filters.projectType) {
        return false;
      }
      return true;
    });
  };

  const getVendorStats = () => {
    const vendorCounts: { [key: string]: number } = {};
    const phaseCounts: { [key: string]: number } = {};
    const sourceCounts: { [key: string]: number } = {};
    const projectTypeCounts: { [key: string]: number } = {};

    selections.forEach(selection => {
      // Vendor counts
      if (selection.vendorName) {
        vendorCounts[selection.vendorName] = (vendorCounts[selection.vendorName] || 0) + 1;
      }

      // Phase counts
      if (selection.phaseOfUse) {
        phaseCounts[selection.phaseOfUse] = (phaseCounts[selection.phaseOfUse] || 0) + 1;
      }

      // Source counts
      sourceCounts[selection.source] = (sourceCounts[selection.source] || 0) + 1;

      // Project type counts
      projectTypeCounts[selection.room.project.category] = (projectTypeCounts[selection.room.project.category] || 0) + 1;
    });

    return { vendorCounts, phaseCounts, sourceCounts, projectTypeCounts };
  };

  const exportData = () => {
    const filteredData = getFilteredSelections();
    const csvContent = [
      ['Vendor', 'Product', 'Color/Finish', 'Phase', 'Project', 'Room', 'Designer', 'Source', 'Date'].join(','),
      ...filteredData.map(selection => [
        selection.vendorName || '',
        selection.productName || '',
        selection.colorFinish || '',
        selection.phaseOfUse || '',
        selection.room.project.name,
        selection.room.name,
        selection.room.project.designer.name,
        selection.source,
        new Date(selection.createdAt).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendor-analytics.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const stats = getVendorStats();
  const filteredSelections = getFilteredSelections();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[var(--text-secondary)]">Loading analytics...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="folio-h1 mb-2">Vendor Analytics</h1>
              <p className="folio-body">Track product selections and designer activity</p>
            </div>
            <Button variant="accent" onClick={exportData}>
              <FaDownload className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <StatsCard label="Total Selections" value={selections.length} />
          <StatsCard label="Unique Vendors" value={Object.keys(stats.vendorCounts).length} />
          <StatsCard label="Camera Captures" value={stats.sourceCounts.camera || 0} />
          <StatsCard label="Final Specs" value={stats.phaseCounts.final_spec || 0} />
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <RidgeCard padding="md" className="mb-8">
            <h3 className="folio-h3 mb-4 flex items-center gap-2">
              <FaFilter className="w-5 h-5" />
              Filters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block folio-meta mb-2">Vendor</label>
                <Input
                  type="text"
                  value={filters.vendorName}
                  onChange={(e) => setFilters(prev => ({ ...prev, vendorName: e.target.value }))}
                  placeholder="Filter by vendor"
                />
              </div>
              <div>
                <label className="block folio-meta mb-2">Phase</label>
                <select
                  value={filters.phaseOfUse}
                  onChange={(e) => setFilters(prev => ({ ...prev, phaseOfUse: e.target.value }))}
                  className="ridge-input w-full px-3 py-2"
                >
                  <option value="">All Phases</option>
                  <option value="moodboard">Moodboard</option>
                  <option value="final_spec">Final Spec</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
              <div>
                <label className="block folio-meta mb-2">Source</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
                  className="ridge-input w-full px-3 py-2"
                >
                  <option value="">All Sources</option>
                  <option value="camera">Camera</option>
                  <option value="upload">Upload</option>
                </select>
              </div>
              <div>
                <label className="block folio-meta mb-2">Project Type</label>
                <select
                  value={filters.projectType}
                  onChange={(e) => setFilters(prev => ({ ...prev, projectType: e.target.value }))}
                  className="ridge-input w-full px-3 py-2"
                >
                  <option value="">All Types</option>
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Hospitality">Hospitality</option>
                </select>
              </div>
            </div>
          </RidgeCard>
        </motion.div>

        {/* Selections Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredSelections.map((selection, index) => (
            <motion.div
              key={selection.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <RidgeCard padding="none" className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Image */}
                <div className="aspect-square bg-[var(--bg-elevated)] relative">
                  {selection.photo ? (
                    <img
                      src={selection.photo}
                      alt="Selection"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FaCamera className="w-12 h-12 text-[var(--text-tertiary)]" />
                    </div>
                  )}

                  {/* Source Badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      selection.source === 'camera'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}>
                      {selection.source}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Product Information */}
                  {selection.productName && (
                    <div className="mb-2">
                      <h4 className="font-semibold text-[var(--text-primary)] text-sm">{selection.productName}</h4>
                      {selection.vendorName && (
                        <p className="text-xs text-[var(--text-secondary)]">{selection.vendorName}</p>
                      )}
                    </div>
                  )}

                  {/* Color/Finish */}
                  {selection.colorFinish && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <FaPalette className="w-3 h-3" />
                        <span>{selection.colorFinish}</span>
                      </div>
                    </div>
                  )}

                  {/* Phase of Use */}
                  {selection.phaseOfUse && (
                    <div className="mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        selection.phaseOfUse === 'final_spec'
                          ? 'bg-green-100 text-green-800'
                          : selection.phaseOfUse === 'pending_approval'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {selection.phaseOfUse.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  )}

                  {/* Project Info */}
                  <div className="mb-2">
                    <p className="text-xs text-[var(--text-secondary)]">
                      <span className="font-medium">{selection.room.project.name}</span> - {selection.room.name}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Designer: {selection.room.project.designer.name}
                    </p>
                  </div>

                  {/* Notes */}
                  {selection.notes && (
                    <div className="mb-3">
                      <div className="flex items-start gap-2">
                        <FaStickyNote className="w-3 h-3 text-[var(--text-tertiary)] mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{selection.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {new Date(selection.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </RidgeCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Empty State */}
        {filteredSelections.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center py-16"
          >
            <RidgeCard padding="xl" className="max-w-md mx-auto">
              <FaChartBar className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
              <h3 className="folio-h3 mb-2">No Selections Found</h3>
              <p className="folio-body mb-6">
                Try adjusting your filters to see more results
              </p>
              <Button
                variant="accent"
                onClick={() => setFilters({ vendorName: '', phaseOfUse: '', source: '', projectType: '' })}
              >
                Clear Filters
              </Button>
            </RidgeCard>
          </motion.div>
        )}
      </div>
    </div>
  );
}
