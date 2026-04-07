'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Users, TrendingUp, Package, DollarSign } from "lucide-react";
import { EventKpis } from "@/lib/mock/eventAnalytics";
import { formatCurrency, formatCompactNumber } from "@/lib/format";

interface KpiStripProps {
  kpis: EventKpis;
}

export function KpiStrip({ kpis }: KpiStripProps) {
  const kpiItems = [
    {
      label: "RSVPs",
      value: formatCompactNumber(kpis.rsvps),
      icon: Users,
      color: "text-folio-text-secondary",
      bgColor: "bg-[#8C8278]/10"
    },
    {
      label: "Attendance",
      value: kpis.attendanceRatePct ? `${kpis.attendanceRatePct}%` : "—",
      icon: TrendingUp,
      color: "text-folio-text-secondary",
      bgColor: "bg-[#8C8278]/10"
    },
    {
      label: "Products Saved",
      value: formatCompactNumber(kpis.productsSaved),
      icon: Package,
      color: "text-folio-text-secondary",
      bgColor: "bg-[#8C8278]/10"
    },
    {
      label: "Est. Project Value",
      value: formatCurrency(kpis.estProjectValueUsd, 'USD', true),
      icon: DollarSign,
      color: "text-folio-text-secondary",
      bgColor: "bg-[#8C8278]/10"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpiItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <Card 
            key={item.label} 
            className="bg-surface-canvas border-folio-border-strong hover:shadow-md transition-shadow"
            data-testid={`kpi-${index}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full ${item.bgColor} mr-4`}>
                  <Icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-folio-text-secondary mb-1">
                    {item.label}
                  </p>
                  <p className="text-2xl font-semibold text-folio-text-primary">
                    {item.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}









