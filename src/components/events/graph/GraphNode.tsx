"use client";

interface GraphNodeProps {
  node: any;
  type: 'designer' | 'vendor' | 'product' | 'rep';
}

export default function GraphNode({ node, type }: GraphNodeProps) {
  const getNodeIcon = () => {
    switch (type) {
      case 'designer':
        return '👤';
      case 'vendor':
        return '🏢';
      case 'product':
        return '📦';
      case 'rep':
        return '🤝';
      default:
        return '•';
    }
  };

  const getNodeColor = () => {
    switch (type) {
      case 'designer':
        return 'bg-[var(--accent)]/5 border-[var(--accent)]/20';
      case 'vendor':
        return 'bg-green-50 border-green-200';
      case 'product':
        return 'bg-purple-50 border-purple-200';
      case 'rep':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-stone-50 border-stone-200';
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${getNodeColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getNodeIcon()}</span>
            <span className="font-medium text-ink text-sm">
              {node.data.name || node.data.title || 'Unknown'}
            </span>
          </div>
          {node.data.email && (
            <p className="text-xs text-stone-500 mt-1">{node.data.email}</p>
          )}
          {node.data.location && (
            <p className="text-xs text-stone-400 mt-1">{node.data.location}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-stone-600">
            Weight: {node.edge.weight.toFixed(2)}
          </div>
          {node.edge.views !== undefined && (
            <div className="text-xs text-stone-400 mt-1">
              {node.edge.views} views
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




