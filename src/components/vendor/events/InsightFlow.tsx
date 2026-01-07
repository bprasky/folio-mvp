'use client';

import { motion } from 'framer-motion';
import { FocusContext } from '@/lib/suggestions/types';

interface FlowNode {
  key: 'event' | 'saves' | 'boards' | 'tags' | 'value';
  label: string;
  value: number;
  help?: string;
}

interface InsightFlowProps {
  nodes: FlowNode[];
  onHover: (ctx: FocusContext | null) => void;
}

export default function InsightFlow({ nodes, onHover }: InsightFlowProps) {
  return (
    <div className="bg-white rounded-xl border border-[#DAD2CA] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-serif text-[#2B2B2B] mb-1">Insight Flow</h3>
        <p className="text-sm text-[#8C8278]">From exposure to intent to value.</p>
      </div>
      
      <div className="flex items-center justify-between relative">
        {nodes.map((node, index) => (
          <div key={node.key} className="flex items-center flex-1">
            <motion.div
              className="flex flex-col items-center cursor-pointer group"
              onMouseEnter={() => onHover({ type: 'node', key: node.key, data: node })}
              onMouseLeave={() => onHover(null)}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-12 h-12 bg-[#8C8278] rounded-full flex items-center justify-center mb-2 group-hover:bg-[#3A332E] transition-colors">
                <span className="text-white text-xs font-medium">
                  {node.key.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-center">
                <div className="text-2xl font-serif text-[#2B2B2B] font-semibold">
                  {node.value.toLocaleString()}
                </div>
                <div className="text-sm text-[#8C8278] capitalize">
                  {node.label}
                </div>
                {node.help && (
                  <div className="text-xs text-[#8C8278] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {node.help}
                  </div>
                )}
              </div>
            </motion.div>
            
            {/* Connector line */}
            {index < nodes.length - 1 && (
              <div className="flex-1 flex items-center justify-center mx-4">
                <div className="h-px bg-[#DAD2CA] w-full relative">
                  <motion.div
                    className="absolute top-0 right-0 w-2 h-2 bg-[#8C8278] rounded-full transform translate-x-1 -translate-y-1"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}









