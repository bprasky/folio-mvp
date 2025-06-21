'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaEdit, 
  FaChevronDown, 
  FaChevronUp, 
  FaArrowLeft, 
  FaArrowRight, 
  FaUsers,
  FaCheck
} from 'react-icons/fa';

export interface LeadPreferences {
  projectTypes: string[];
  idealBudgetRange: string;
  minimumBudget: string;
  locationPreferences: string[];
  roomTypes: string[];
  designStyles: string[];
  engagementStyle: string;
}

interface LeadPreferencesCardProps {
  preferences: LeadPreferences | null;
  onSave: (preferences: LeadPreferences) => void;
}

const PROJECT_TYPES = [
  { value: 'new-build', label: 'New Build' },
  { value: 'full-renovation', label: 'Full Renovation' },
  { value: 'decor-only', label: 'Decor Only' },
  { value: 'commercial', label: 'Commercial' },
];

const BUDGET_RANGES = [
  '$10,000 - $25,000',
  '$25,000 - $50,000',
  '$50,000 - $100,000',
  '$100,000 - $250,000',
  '$250,000 - $500,000',
  '$500,000+'
];

export default function LeadPreferencesCard({ preferences, onSave }: LeadPreferencesCardProps) {
  const [isExpanded, setIsExpanded] = useState(!preferences);
  const [isEditing, setIsEditing] = useState(!preferences);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<LeadPreferences>>(
    preferences || {
      projectTypes: [],
      idealBudgetRange: '',
      minimumBudget: '',
      locationPreferences: [],
      roomTypes: [],
      designStyles: [],
      engagementStyle: ''
    }
  );

  const totalSteps = 4; // Simplified for demo

  const handleSave = () => {
    onSave(formData as LeadPreferences);
    setIsEditing(false);
    setIsExpanded(false);
    setCurrentStep(1);
  };

  const toggleMultiSelect = (field: keyof LeadPreferences, value: string) => {
    const currentArray = formData[field] as string[] || [];
    if (currentArray.includes(value)) {
      setFormData(prev => ({
        ...prev,
        [field]: currentArray.filter(item => item !== value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: [...currentArray, value]
      }));
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.projectTypes && formData.projectTypes.length > 0;
      case 2: return !!formData.idealBudgetRange;
      case 3: return !!formData.minimumBudget;
      case 4: return !!formData.engagementStyle;
      default: return false;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg overflow-hidden"
    >
      <div 
        className="p-6 border-b border-gray-100 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
              <FaUsers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Your Lead Preferences</h2>
              <p className="text-sm text-gray-600">
                {preferences ? 'Configure your ideal project criteria' : 'Set up project matching'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {preferences && !isEditing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                  setIsExpanded(true);
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <FaEdit className="w-3 h-3 mr-2 inline" />
                Edit
              </button>
            )}
            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6">
              {!isEditing && preferences ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Project Types</h4>
                      <div className="flex flex-wrap gap-2">
                        {preferences.projectTypes.map(type => (
                          <span key={type} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {type.replace('-', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Ideal Budget</h4>
                      <p className="text-gray-700">{preferences.idealBudgetRange}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Step {currentStep} of {totalSteps}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    {currentStep === 1 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Preferred Project Types</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {PROJECT_TYPES.map((type) => {
                            const isSelected = formData.projectTypes?.includes(type.value);
                            return (
                              <button
                                key={type.value}
                                onClick={() => toggleMultiSelect('projectTypes', type.value)}
                                className={`p-3 rounded-xl border-2 transition-all ${
                                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {type.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {currentStep === 2 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Ideal Budget Range</h3>
                        <div className="space-y-2">
                          {BUDGET_RANGES.map((budget) => (
                            <button
                              key={budget}
                              onClick={() => setFormData(prev => ({ ...prev, idealBudgetRange: budget }))}
                              className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                                formData.idealBudgetRange === budget ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                              }`}
                            >
                              {budget}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentStep === 3 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Minimum Budget</h3>
                        <div className="space-y-2">
                          {BUDGET_RANGES.slice(0, -1).map((budget) => (
                            <button
                              key={budget}
                              onClick={() => setFormData(prev => ({ ...prev, minimumBudget: budget }))}
                              className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                                formData.minimumBudget === budget ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                              }`}
                            >
                              {budget}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentStep === 4 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Engagement Style</h3>
                        <div className="space-y-3">
                          {[
                            { value: 'full-service', label: 'Full Service' },
                            { value: 'collaborative', label: 'Collaborative' },
                            { value: 'consulting', label: 'Consulting' }
                          ].map((style) => (
                            <button
                              key={style.value}
                              onClick={() => setFormData(prev => ({ ...prev, engagementStyle: style.value }))}
                              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                formData.engagementStyle === style.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                              }`}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                      disabled={currentStep === 1}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <FaArrowLeft className="w-4 h-4" />
                      Back
                    </button>

                    {currentStep === totalSteps ? (
                      <button
                        onClick={handleSave}
                        disabled={!canProceed()}
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-xl font-medium disabled:opacity-50"
                      >
                        <FaCheck className="w-4 h-4" />
                        Save Preferences
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentStep(currentStep + 1)}
                        disabled={!canProceed()}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50"
                      >
                        Next
                        <FaArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
} 