'use client';

import { motion } from 'framer-motion';
import { Suggestion } from '@/lib/suggestions/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, TestTube } from 'lucide-react';

interface SmartSuggestionsProps {
  suggestions: Suggestion[];
  onAction: (suggestion: Suggestion) => void;
}

const impactIcons = {
  High: TrendingUp,
  Medium: Lightbulb,
  Test: TestTube
};

const impactColors = {
  High: 'bg-green-100 text-green-800',
  Medium: 'bg-[var(--accent)]/10 text-blue-800',
  Test: 'bg-purple-100 text-purple-800'
};

export default function SmartSuggestions({ suggestions, onAction }: SmartSuggestionsProps) {
  if (suggestions.length === 0) {
    return (
      <div className="sticky top-6">
        <Card className="bg-white border-[#DAD2CA]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-serif text-[#2B2B2B]">
              Smart Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#8C8278]">
              Hover over charts or data to get contextual suggestions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="sticky top-6 space-y-4">
      <Card className="bg-white border-[#DAD2CA]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif text-[#2B2B2B]">
            Smart Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestions.map((suggestion, index) => {
            const ImpactIcon = impactIcons[suggestion.impact];
            return (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="p-4 bg-[#F7F4F1] rounded-lg border border-[#DAD2CA]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-[#2B2B2B] mb-1">
                        {suggestion.title}
                      </h4>
                      <p className="text-xs text-[#8C8278] mb-2">
                        {suggestion.reason}
                      </p>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`ml-2 ${impactColors[suggestion.impact]} border-0`}
                    >
                      <ImpactIcon className="w-3 h-3 mr-1" />
                      {suggestion.impact}
                    </Badge>
                  </div>
                  <Button
                    onClick={() => onAction(suggestion)}
                    size="sm"
                    className="w-full bg-[#8C8278] hover:bg-[#3A332E] text-white text-xs"
                  >
                    {suggestion.actionLabel}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}









