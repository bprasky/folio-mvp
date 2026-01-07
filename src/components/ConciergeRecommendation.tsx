import React, { useState, useEffect } from 'react';
import { FaRobot, FaTimes, FaLightbulb, FaArrowRight } from 'react-icons/fa';
import clsx from 'clsx';

interface ConciergeRecommendationProps {
  userRole: string;
  isFirstTimeUser: boolean;
  onTryConcierge: () => void;
  onDismiss: () => void;
  className?: string;
}

export default function ConciergeRecommendation({ 
  userRole, 
  isFirstTimeUser, 
  onTryConcierge, 
  onDismiss, 
  className 
}: ConciergeRecommendationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenDismissed, setHasBeenDismissed] = useState(false);

  useEffect(() => {
    // Show recommendation for first-time users or vendors
    if (isFirstTimeUser || userRole === 'vendor') {
      const dismissed = localStorage.getItem('concierge-recommendation-dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    }
  }, [isFirstTimeUser, userRole]);

  const handleDismiss = () => {
    setIsVisible(false);
    setHasBeenDismissed(true);
    localStorage.setItem('concierge-recommendation-dismissed', 'true');
    onDismiss();
  };

  const handleTryConcierge = () => {
    setIsVisible(false);
    onTryConcierge();
  };

  if (!isVisible || hasBeenDismissed) return null;

  const getRecommendationMessage = () => {
    if (userRole === 'vendor') {
      return {
        title: "Quick Event Creation for Vendors",
        message: "Create events faster with our AI assistant. Perfect for product launches and showroom events.",
        cta: "Try Concierge"
      };
    } else if (isFirstTimeUser) {
      return {
        title: "New to Folio? Try Our Event Concierge",
        message: "Skip the form and describe your event naturally. Our AI will help you create it in seconds.",
        cta: "Get Started"
      };
    } else {
      return {
        title: "Need a Quick Event?",
        message: "Use our conversational assistant to create events faster than ever.",
        cta: "Try Concierge"
      };
    }
  };

  const message = getRecommendationMessage();

  return (
    <div className={clsx(
      "fixed top-4 right-4 max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 animate-in slide-in-from-right duration-300",
      className
    )}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-folio-accent rounded-full flex items-center justify-center">
            <FaLightbulb className="w-5 h-5 text-white" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              {message.title}
            </h3>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-3">
            {message.message}
          </p>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleTryConcierge}
              className="inline-flex items-center px-3 py-1.5 bg-folio-accent text-white text-sm font-medium rounded-md hover:bg-folio-accent-dark transition-colors"
            >
              <FaRobot className="w-3 h-3 mr-1" />
              {message.cta}
              <FaArrowRight className="w-3 h-3 ml-1" />
            </button>
            
            <button
              onClick={handleDismiss}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
      
      {/* Progress indicator for first-time users */}
      {isFirstTimeUser && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Getting started with Folio</span>
            <span>1 of 3</span>
          </div>
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
            <div className="bg-folio-accent h-1 rounded-full" style={{ width: '33%' }}></div>
          </div>
        </div>
      )}
    </div>
  );
} 