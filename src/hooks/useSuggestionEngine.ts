import { useState, useCallback, useMemo } from 'react';
import { EventAnalytics } from '@/lib/mock/eventAnalytics';
import { Suggestion, FocusContext } from '@/lib/suggestions/types';
import {
  suggestionsForRoom,
  suggestionsForTime,
  suggestionsForPhase,
  suggestionsForCity,
  suggestionsForNode,
  suggestionsForDesigner,
  suggestionsForProduct
} from '@/lib/suggestions/rules';

interface UseSuggestionEngineProps {
  analytics: EventAnalytics;
  focus?: FocusContext | null;
}

export function useSuggestionEngine({ analytics, focus }: UseSuggestionEngineProps) {

  const suggestions = useMemo(() => {
    if (!focus) {
      // Return fallback suggestions when no focus
      return [
        {
          id: 'fallback-1',
          title: 'Review top-performing room types',
          reason: 'Kitchens driving 45% of saves',
          impact: 'High' as const,
          actionLabel: 'View Insights',
          actionType: 'editorial' as const
        },
        {
          id: 'fallback-2',
          title: 'Message top 3 designers',
          reason: 'High influence scores detected',
          impact: 'Medium' as const,
          actionLabel: 'Send Messages',
          actionType: 'message' as const
        }
      ];
    }

    switch (focus.type) {
      case 'room':
        return suggestionsForRoom(focus, analytics);
      case 'time':
        return suggestionsForTime(focus, analytics);
      case 'phase':
        return suggestionsForPhase(focus, analytics);
      case 'city':
        return suggestionsForCity(focus, analytics);
      case 'node':
        return suggestionsForNode(focus, analytics);
      case 'designer':
        return suggestionsForDesigner(focus, analytics);
      case 'product':
        return suggestionsForProduct(focus, analytics);
      default:
        return [];
    }
  }, [focus, analytics]);

  return {
    suggestions
  };
}
