'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Filter, RotateCcw } from "lucide-react";

interface EventFiltersProps {
  eventId: string;
}

export function EventFilters({ eventId }: EventFiltersProps) {
  const [dateRange, setDateRange] = useState("event-window");
  const [cityFilter, setCityFilter] = useState("all");

  const handleApply = () => {
    // In a real app, this would update the analytics data based on filters
    console.log('Applying filters:', { eventId, dateRange, cityFilter });
  };

  const handleReset = () => {
    setDateRange("event-window");
    setCityFilter("all");
  };

  return (
    <Card className="bg-white border-[#DAD2CA]">
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Date Range */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-[#2B2B2B] whitespace-nowrap">
              Date Range:
            </label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px] border-[#DAD2CA]">
                <SelectValue>
                  {dateRange === 'event-window' ? 'Event Window' :
                   dateRange === 'last-7-days' ? 'Last 7 Days' :
                   dateRange === 'last-30-days' ? 'Last 30 Days' :
                   dateRange === 'last-90-days' ? 'Last 90 Days' : 'Event Window'}
                </SelectValue>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event-window">Event Window</SelectItem>
                <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                <SelectItem value="last-90-days">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* City Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-[#2B2B2B] whitespace-nowrap">
              City:
            </label>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[120px] border-[#DAD2CA]">
                <SelectValue>
                  {cityFilter === 'all' ? 'All Cities' :
                   cityFilter === 'new-york' ? 'New York' :
                   cityFilter === 'miami' ? 'Miami' :
                   cityFilter === 'los-angeles' ? 'Los Angeles' :
                   cityFilter === 'chicago' ? 'Chicago' : 'All Cities'}
                </SelectValue>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                <SelectItem value="new-york">New York</SelectItem>
                <SelectItem value="miami">Miami</SelectItem>
                <SelectItem value="los-angeles">Los Angeles</SelectItem>
                <SelectItem value="chicago">Chicago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 ml-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              className="border-[#DAD2CA]"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button 
              size="sm" 
              onClick={handleApply}
              className="bg-[#2B2B2B] hover:bg-[#8C8278]"
            >
              <Filter className="w-4 h-4 mr-2" />
              Apply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
