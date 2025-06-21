'use client';

import { useEffect, useState } from 'react';
import VendorOverviewCard from '@/components/vendor/VendorOverviewCard';
import ProductAnalyticsTable from '@/components/vendor/ProductAnalyticsTable';
import EventMetricsPanel from '@/components/vendor/EventMetricsPanel';
import TopSavedProductsLeaderboard from '@/components/vendor/TopSavedProductsLeaderboard';
import NewDesignersEngagedCard from '@/components/vendor/NewDesignersEngagedCard';

interface VendorAnalytics {
  vendor_name: string;
  new_designers_30d: number;
  product_list: {
    product_id: string;
    product_name: string;
    views_total: number;
    saves_total: number;
    saves_last_7_days: number;
    designers_saved: number;
    events_featured: string[];
    outbound_clicks: number;
    save_velocity_7d: number[];
    saved_together: string[];
  }[];
  event_metrics: {
    event_name: string;
    views_during_event: number;
    saves_during_event: number;
    qr_scans: number;
    designers_engaged: number;
  }[];
}

export default function VendorDashboard() {
  console.log('VendorDashboard component is rendering');
  const [analytics, setAnalytics] = useState<VendorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real application, this would be an API call
    const fetchAnalytics = async () => {
      try {
        console.log('Attempting to fetch /vendor_analytics.json from public directory');
        const response = await fetch('/vendor_analytics.json');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Fetched data:', data);
        setAnalytics(data);
      } catch (error) {
        console.error('Error fetching vendor analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded mb-8"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Error loading dashboard</h1>
          <p className="mt-2 text-gray-600">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{analytics.vendor_name} Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <VendorOverviewCard
          totalViews={analytics.product_list.reduce((sum, p) => sum + p.views_total, 0)}
          totalSaves={analytics.product_list.reduce((sum, p) => sum + p.saves_total, 0)}
          eventsFeatured={analytics.event_metrics.length}
          topProducts={analytics.product_list
            .sort((a, b) => b.saves_total - a.saves_total)
            .slice(0, 3)}
        />
        <NewDesignersEngagedCard newDesigners={analytics.new_designers_30d} />
        <TopSavedProductsLeaderboard products={analytics.product_list} />
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Product Analytics</h2>
        <ProductAnalyticsTable products={analytics.product_list} />
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Event Performance</h2>
        <EventMetricsPanel events={analytics.event_metrics} />
      </div>
    </div>
  );
} 