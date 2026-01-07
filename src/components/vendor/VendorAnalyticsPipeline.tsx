'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, FileText, Clock, DollarSign } from 'lucide-react';

interface PipelineSnapshot {
  specified: number;
  awaitingApproval: number;
  quoted: number;
}

interface VendorAnalyticsPipelineProps {
  data: PipelineSnapshot;
  title?: string;
  description?: string;
}

export default function VendorAnalyticsPipeline({ 
  data, 
  title = "Pipeline Snapshot", 
  description = "Project status overview" 
}: VendorAnalyticsPipelineProps) {
  const total = data.specified + data.awaitingApproval + data.quoted;
  const stages = [
    {
      key: 'specified',
      label: 'Specified',
      count: data.specified,
      icon: FileText,
      color: 'bg-blue-500',
      description: 'Projects with specifications'
    },
    {
      key: 'awaitingApproval',
      label: 'Awaiting Approval',
      count: data.awaitingApproval,
      icon: Clock,
      color: 'bg-yellow-500',
      description: 'Pending designer approval'
    },
    {
      key: 'quoted',
      label: 'Quoted',
      count: data.quoted,
      icon: DollarSign,
      color: 'bg-green-500',
      description: 'Quotes submitted'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage) => {
            const percentage = total > 0 ? (stage.count / total) * 100 : 0;
            
            return (
              <div key={stage.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <stage.icon className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">{stage.label}</span>
                  </div>
                  <Badge variant="secondary">{stage.count}</Badge>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${stage.color} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{stage.description}</p>
              </div>
            );
          })}
          
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total Projects</span>
              <Badge variant="outline">{total}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

