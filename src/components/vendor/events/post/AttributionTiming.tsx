'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Clock, Calendar, QrCode, Users, Mail, Image as ImageIcon } from "lucide-react";
import type { Attribution } from "@/lib/mock/eventPost";
import { formatPercentage } from "@/lib/format";

interface AttributionTimingProps {
  attribution: Attribution;
}

export function AttributionTiming({ attribution }: AttributionTimingProps) {
  // Color mapping for touchpoints
  const touchpointColors = {
    "Booth QR": "#8C8278",
    "Session": "#3A332E", 
    "Folio Post": "#DAD2CA",
    "Email Invite": "#2B2B2B"
  };

  const chartData = attribution.touchpoints.map(tp => ({
    name: tp.channel,
    value: tp.pct,
    color: touchpointColors[tp.channel]
  }));

  const getTouchpointIcon = (channel: string) => {
    switch (channel) {
      case "Booth QR": return QrCode;
      case "Session": return Users;
      case "Folio Post": return ImageIcon;
      case "Email Invite": return Mail;
      default: return Clock;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Attribution */}
      <Card className="bg-surface-canvas border-folio-border-strong">
        <CardHeader>
          <CardTitle className="text-lg font-serif text-folio-text-primary flex items-center space-x-2">
            <Clock className="w-5 h-5 text-folio-text-secondary" />
            <span>Attribution</span>
          </CardTitle>
          <p className="text-sm text-folio-text-secondary">
            What sparked engagement
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 mb-4 min-h-[192px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minHeight={192}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {attribution.touchpoints.map((touchpoint) => {
              const IconComponent = getTouchpointIcon(touchpoint.channel);
              return (
                <div key={touchpoint.channel} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <IconComponent className="w-4 h-4 text-folio-text-secondary" />
                    <span className="text-sm text-folio-text-primary">{touchpoint.channel}</span>
                  </div>
                  <Badge className="bg-surface-elevated text-folio-text-primary border-folio-border-strong">
                    {formatPercentage(touchpoint.pct, 1)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Best Send Times */}
      <Card className="bg-surface-canvas border-folio-border-strong">
        <CardHeader>
          <CardTitle className="text-lg font-serif text-folio-text-primary flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-folio-text-secondary" />
            <span>Best Send Times</span>
          </CardTitle>
          <p className="text-sm text-folio-text-secondary">
            Top engagement windows from event week
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {attribution.bestHours.map((hour, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-[#8C8278] text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-folio-text-primary">{hour.dow}</p>
                    <p className="text-sm text-folio-text-secondary">
                      {hour.hour}:00 {(hour.hour >= 12 ? 'PM' : 'AM')}
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  Peak
                </Badge>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-folio-border-strong">
            <Button className="w-full bg-folio-text-primary hover:bg-[#8C8278] text-white">
              Schedule Follow-ups at Best Times
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
