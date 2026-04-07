"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Users, Package, Building2, UserCheck, TrendingUp, Loader2 } from 'lucide-react';
import Link from 'next/link';
import GraphNode from './graph/GraphNode';
import GraphMetrics from './graph/GraphMetrics';
import GraphFilters from './graph/GraphFilters';

interface EventGraphViewProps {
  eventId: string;
}

interface GraphData {
  event: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
  };
  nodes: {
    designers: any[];
    vendors: any[];
    products: any[];
    reps: any[];
  };
  edges: any[];
  metrics: any;
  summary: {
    totalDesigners: number;
    totalVendors: number;
    totalProducts: number;
    totalReps: number;
    totalRelationships: number;
  };
}

export default function EventGraphView({ eventId }: EventGraphViewProps) {
  const { data: session } = useSession();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    nodeType: 'all' as 'all' | 'designers' | 'vendors' | 'products' | 'reps',
    minWeight: 0,
  });

  useEffect(() => {
    fetchGraphData();
  }, [eventId]);

  const fetchGraphData = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/graph`);
      const data = await response.json();

      if (response.ok) {
        setGraphData(data);
      } else {
        setError(data.error || 'Failed to load graph data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load graph data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-folio-text-tertiary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!graphData) {
    return null;
  }

  const filteredNodes = {
    designers: filters.nodeType === 'all' || filters.nodeType === 'designers' 
      ? graphData.nodes.designers.filter((n) => n.edge.weight >= filters.minWeight)
      : [],
    vendors: filters.nodeType === 'all' || filters.nodeType === 'vendors'
      ? graphData.nodes.vendors.filter((n) => n.edge.weight >= filters.minWeight)
      : [],
    products: filters.nodeType === 'all' || filters.nodeType === 'products'
      ? graphData.nodes.products.filter((n) => n.edge.weight >= filters.minWeight)
      : [],
    reps: filters.nodeType === 'all' || filters.nodeType === 'reps'
      ? graphData.nodes.reps.filter((n) => n.edge.weight >= filters.minWeight)
      : [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center text-sm text-folio-text-tertiary hover:text-ink mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Event
          </Link>
          <h1 className="text-2xl font-serif font-medium text-ink">
            Event Graph: {graphData.event.title}
          </h1>
        </div>
      </div>

      {/* Metrics Summary */}
      <GraphMetrics metrics={graphData.metrics} summary={graphData.summary} />

      {/* Filters */}
      <GraphFilters filters={filters} onFiltersChange={setFilters} />

      {/* Graph Visualization */}
      <div className="bg-surface-canvas rounded-xl border border-folio-border-subtle shadow-sm p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Designers */}
          {filteredNodes.designers.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Users className="w-5 h-5 text-folio-text-tertiary" />
                <h3 className="font-medium text-ink">
                  Designers ({filteredNodes.designers.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredNodes.designers.map((node) => (
                  <GraphNode key={node.id} node={node} type="designer" />
                ))}
              </div>
            </div>
          )}

          {/* Vendors */}
          {filteredNodes.vendors.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Building2 className="w-5 h-5 text-folio-text-tertiary" />
                <h3 className="font-medium text-ink">
                  Vendors ({filteredNodes.vendors.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredNodes.vendors.map((node) => (
                  <GraphNode key={node.id} node={node} type="vendor" />
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {filteredNodes.products.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Package className="w-5 h-5 text-folio-text-tertiary" />
                <h3 className="font-medium text-ink">
                  Products ({filteredNodes.products.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredNodes.products.map((node) => (
                  <GraphNode key={node.id} node={node} type="product" />
                ))}
              </div>
            </div>
          )}

          {/* Reps */}
          {filteredNodes.reps.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <UserCheck className="w-5 h-5 text-folio-text-tertiary" />
                <h3 className="font-medium text-ink">
                  Reps ({filteredNodes.reps.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredNodes.reps.map((node) => (
                  <GraphNode key={node.id} node={node} type="rep" />
                ))}
              </div>
            </div>
          )}
        </div>

        {Object.values(filteredNodes).every((nodes) => nodes.length === 0) && (
          <div className="text-center py-12 text-folio-text-tertiary">
            No nodes match the current filters
          </div>
        )}
      </div>

      {/* Relationships */}
      {graphData.edges.length > 0 && (
        <div className="bg-surface-canvas rounded-xl border border-folio-border-subtle shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-folio-text-tertiary" />
            <h3 className="font-medium text-ink">
              Relationships ({graphData.edges.length})
            </h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {graphData.edges.slice(0, 20).map((edge) => (
              <div
                key={edge.id}
                className="p-3 bg-surface-ground rounded-lg text-sm"
              >
                <span className="font-medium">{edge.sourceType}</span>
                {' → '}
                <span className="font-medium">{edge.targetType}</span>
                {' ('}
                <span className="text-folio-text-tertiary">{edge.relationshipType}</span>
                {', weight: '}
                <span className="text-folio-text-tertiary">{edge.weight.toFixed(2)}</span>
                {')'}
              </div>
            ))}
            {graphData.edges.length > 20 && (
              <div className="text-xs text-folio-text-tertiary pt-2">
                +{graphData.edges.length - 20} more relationships
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}




