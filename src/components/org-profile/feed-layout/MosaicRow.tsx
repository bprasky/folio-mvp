'use client';

import { motion } from 'framer-motion';
import type { MosaicRow as MosaicRowType } from '@/lib/feed/mosaic-layout';
import MosaicCard from './MosaicCard';

interface MosaicRowProps {
  row: MosaicRowType;
  rowIndex: number;
}

export default function MosaicRow({ row, rowIndex }: MosaicRowProps) {
  if (row.pattern === 'C') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rowIndex * 0.06 }}
      >
        <MosaicCard project={row.slots[0].project} size="full" />
      </motion.div>
    );
  }

  // Pattern A: large left, smalls right
  // Pattern B: smalls left, large right
  const largeSlot = row.slots[0];
  const smallSlots = row.slots.slice(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rowIndex * 0.06 }}
    >
      {row.pattern === 'A' ? (
        <div className="grid grid-cols-[3fr_2fr] gap-3">
          {/* Large left */}
          <div className="row-span-2">
            <MosaicCard project={largeSlot.project} size="large" />
          </div>
          {/* Smalls stacked right */}
          <div className="grid grid-rows-2 gap-3">
            {smallSlots.map((slot, i) => (
              <MosaicCard key={i} project={slot.project} size="small" />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[2fr_3fr] gap-3">
          {/* Smalls stacked left */}
          <div className="grid grid-rows-2 gap-3">
            {smallSlots.map((slot, i) => (
              <MosaicCard key={i} project={slot.project} size="small" />
            ))}
          </div>
          {/* Large right */}
          <div className="row-span-2">
            <MosaicCard project={largeSlot.project} size="large" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
