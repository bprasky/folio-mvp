'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, DollarSign, UserCheck } from "lucide-react";
import { PortfolioKpis } from "@/lib/mock/eventsPortfolio";
import { formatCurrency, formatCompactNumber } from "@/lib/format";

interface PortfolioKpisProps {
  data: PortfolioKpis;
}

export function PortfolioKpis({ data }: PortfolioKpisProps) {
  const kpiItems = [
    {
      label: "Total RSVPs",
      value: data.totalRsvps,
      delta: data.deltas.rsvpsPct,
      icon: Users,
      formatter: formatCompactNumber
    },
    {
      label: "Products Saved",
      value: data.totalSaves,
      delta: data.deltas.savesPct,
      icon: TrendingUp,
      formatter: formatCompactNumber
    },
    {
      label: "Est. Project Value",
      value: data.estValueUsd,
      delta: data.deltas.valuePct,
      icon: DollarSign,
      formatter: (value: number) => formatCurrency(value, 'USD', true)
    },
    {
      label: "Active Designers",
      value: data.activeDesigners,
      delta: data.deltas.designersPct,
      icon: UserCheck,
      formatter: formatCompactNumber
    }
  ];

  return (
    <Card className="bg-white border-[#DAD2CA]">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-[#2B2B2B]">
          Portfolio Totals
        </CardTitle>
        <p className="text-sm text-[#8C8278]">
          Combined performance across all events
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiItems.map((item, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-[#8C8278]/10 rounded-full mb-3 mx-auto">
                <item.icon className="w-6 h-6 text-[#8C8278]" />
              </div>
              <p className="text-sm text-[#8C8278] mb-2">{item.label}</p>
              <p className="text-xl font-semibold text-[#2B2B2B] mb-2">
                {item.formatter(item.value)}
              </p>
              <div className="flex items-center justify-center">
                <Badge 
                  className={`text-xs ${
                    item.delta >= 0 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : 'bg-red-100 text-red-800 border-red-200'
                  }`}
                >
                  {item.delta >= 0 ? '↗' : '↘'} {Math.abs(item.delta)}%
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}









