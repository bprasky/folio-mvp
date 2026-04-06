'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaSort, FaSortUp, FaSortDown, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { DirectoryEntry, SortField, SortDirection } from '@/types/directory';
import RepEmailCell from './RepEmailCell';

interface DirectoryTableProps {
  entries: DirectoryEntry[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

export default function DirectoryTable({
  entries,
  sortField,
  sortDirection,
  onSort,
}: DirectoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (productId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedRows(newExpanded);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <FaSort className="text-folio-text-tertiary" />;
    }
    return sortDirection === 'asc' 
      ? <FaSortUp className="text-folio-text-secondary" />
      : <FaSortDown className="text-folio-text-secondary" />;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="glass-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-ground border-b border-folio-border-subtle">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-folio-text-secondary uppercase tracking-[0.05em]">
                Product
              </th>
              <th 
                className="px-4 py-3 text-left text-[11px] font-medium text-folio-text-secondary uppercase tracking-[0.05em] cursor-pointer hover:bg-surface-ground transition-colors"
                onClick={() => onSort('productBrand')}
              >
                <div className="flex items-center gap-2">
                  Vendor
                  {getSortIcon('productBrand')}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-[11px] font-medium text-folio-text-secondary uppercase tracking-[0.05em] cursor-pointer hover:bg-surface-ground transition-colors"
                onClick={() => onSort('category')}
              >
                <div className="flex items-center gap-2">
                  Category
                  {getSortIcon('category')}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-[11px] font-medium text-folio-text-secondary uppercase tracking-[0.05em] cursor-pointer hover:bg-surface-ground transition-colors"
                onClick={() => onSort('projectCount')}
              >
                <div className="flex items-center gap-2">
                  Projects
                  {getSortIcon('projectCount')}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-folio-text-secondary uppercase tracking-[0.05em]">
                Rooms
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-folio-text-secondary uppercase tracking-[0.05em]">
                Rep Email
              </th>
              <th 
                className="px-4 py-3 text-left text-[11px] font-medium text-folio-text-secondary uppercase tracking-[0.05em] cursor-pointer hover:bg-surface-ground transition-colors"
                onClick={() => onSort('lastUsedAt')}
              >
                <div className="flex items-center gap-2">
                  Last Used
                  {getSortIcon('lastUsedAt')}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-[11px] font-medium text-folio-text-secondary uppercase tracking-[0.05em] cursor-pointer hover:bg-surface-ground transition-colors"
                onClick={() => onSort('tagCount')}
              >
                <div className="flex items-center gap-2">
                  Times Used
                  {getSortIcon('tagCount')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-folio-border-subtle">
            {entries.map((entry) => {
              const isExpanded = expandedRows.has(entry.productId);
              const projectsPreview = entry.projects.slice(0, 2);
              const hasMoreProjects = entry.projects.length > 2;

              return (
                <>
                  <tr 
                    key={entry.productId}
                    className="bg-white hover:bg-surface-ground transition-colors"
                  >
                    {/* Product */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-10 w-10 relative rounded-md overflow-hidden bg-surface-ground" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)' }}>
                          {entry.productImageUrl ? (
                            <Image
                              src={entry.productImageUrl}
                              alt={entry.productName}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-folio-text-tertiary text-xs">
                              No Image
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-folio-text-primary">
                            {entry.productName}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Vendor */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-folio-text-secondary">
                        {entry.productBrand || '—'}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-folio-text-secondary">
                        {entry.productCategory || '—'}
                      </div>
                    </td>

                    {/* Projects */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-folio-text-secondary">
                        {projectsPreview.map((project, idx) => (
                          <div key={project.projectId}>
                            <Link
                              href={`/project/${project.projectId}`}
                              className="hover:text-folio-text-secondary hover:underline transition-colors"
                            >
                              {project.projectTitle}
                            </Link>
                          </div>
                        ))}
                        {hasMoreProjects && (
                          <button
                            onClick={() => toggleRow(entry.productId)}
                            className="text-folio-text-secondary hover:text-folio-text-secondary text-sm mt-1 flex items-center gap-1 transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                <FaChevronDown className="text-xs" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <FaChevronRight className="text-xs" />
                                +{entry.projects.length - 2} more
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Rooms */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-folio-text-secondary">
                        {isExpanded ? (
                          <div>
                            {entry.projects.map((project, idx) => (
                              <div key={idx}>
                                {project.roomName || '—'}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div>
                            {Array.from(new Set(
                              entry.projects.map(p => p.roomName).filter(Boolean)
                            )).slice(0, 2).join(', ') || '—'}
                            {entry.projects.filter(p => p.roomName).length > 2 && !isExpanded && (
                              <span className="text-folio-text-tertiary">...</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Rep Email */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <RepEmailCell
                        entry={entry}
                        onUpdate={() => {
                          // Reload directory after update
                          window.location.reload();
                        }}
                      />
                    </td>

                    {/* Last Used */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-folio-text-secondary">
                        {formatDate(entry.lastUsedAt)}
                      </div>
                    </td>

                    {/* Times Used */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-folio-text-secondary">
                        {entry.tagCount}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row */}
                  {isExpanded && (
                    <tr className="bg-surface-ground">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="pl-12">
                          <div className="text-sm font-medium text-folio-text-secondary mb-2">
                            All Projects & Rooms:
                          </div>
                          <div className="space-y-1">
                            {entry.projects.map((project, idx) => (
                              <div key={idx} className="text-sm text-folio-text-secondary">
                                <Link
                                  href={`/project/${project.projectId}`}
                                  className="hover:text-folio-text-secondary hover:underline transition-colors"
                                >
                                  {project.projectTitle}
                                </Link>
                                {project.roomName && (
                                  <span className="text-folio-text-tertiary ml-2">
                                    • {project.roomName}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

