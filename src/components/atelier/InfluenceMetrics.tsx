"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FaTag, FaDollarSign, FaShoppingCart, FaHandshake } from 'react-icons/fa';

interface InfluenceMetricsProps {
  totalTaggedProducts: number;
  influenceValue: number;
  atelierOrders: number;
  vendorPartnerships: number;
}

export default function InfluenceMetrics({
  totalTaggedProducts,
  influenceValue,
  atelierOrders,
  vendorPartnerships,
}: InfluenceMetricsProps) {
  const metrics = [
    {
      label: 'Total Tagged Products',
      value: totalTaggedProducts.toLocaleString(),
      icon: <FaTag className="w-5 h-5" />,
      description: 'Products across all projects',
    },
    {
      label: 'Influence Value',
      value: `$${influenceValue.toLocaleString()}`,
      icon: <FaDollarSign className="w-5 h-5" />,
      description: 'Product value added to project files',
    },
    {
      label: 'Atelier Orders',
      value: atelierOrders.toLocaleString(),
      icon: <FaShoppingCart className="w-5 h-5" />,
      description: 'Total service orders',
    },
    {
      label: 'Vendor Partnerships',
      value: vendorPartnerships.toLocaleString(),
      icon: <FaHandshake className="w-5 h-5" />,
      description: 'Active collaborations',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
          className="bg-white/70 backdrop-blur-md border border-folio-stone-100 rounded-xl p-4 hover:shadow-folio1 transition-all duration-300"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="text-folio-accent-400">{metric.icon}</div>
            <h3 className="text-xs font-sans text-folio-stone-500 uppercase tracking-wide">
              {metric.label}
            </h3>
          </div>
          <div className="text-xl font-serif text-folio-ink mb-1">
            {metric.value}
          </div>
          <p className="text-xs text-folio-stone-400 font-sans">{metric.description}</p>
        </motion.div>
      ))}
    </div>
  );
}
