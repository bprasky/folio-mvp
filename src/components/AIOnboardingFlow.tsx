'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaTimes, 
  FaArrowLeft, 
  FaArrowRight, 
  FaHome, 
  FaBed, 
  FaCouch, 
  FaUtensils,
  FaBath,
  FaDollarSign,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaPalette,
  FaRobot
} from 'react-icons/fa';

export interface ProjectData {
  name: string;
  projectType: string;
  rooms: string[];
  budget: string;
  timeline: string;
  location: string;
  style: string[];
}

interface AIOnboardingFlowProps {
  isOpen: boolean;
  projectName: string;
  onClose: () => void;
  onComplete: (data: ProjectData) => void;
}

const projectTypes = [
  { value: 'renovation', label: 'Renovation', icon: FaHome, color: 'bg-orange-500' },
  { value: 'new-build', label: 'New Build', icon: FaHome, color: 'bg-green-500' },
  { value: 'decorating', label: 'Decorating', icon: FaPalette, color: 'bg-purple-500' },
];

const roomOptions = [
  { value: 'living-room', label: 'Living Room', icon: FaCouch },
  { value: 'bedroom', label: 'Bedroom', icon: FaBed },
  { value: 'kitchen', label: 'Kitchen', icon: FaUtensils },
  { value: 'bathroom', label: 'Bathroom', icon: FaBath },
  { value: 'dining-room', label: 'Dining Room', icon: FaUtensils },
  { value: 'home-office', label: 'Home Office', icon: FaHome },
];

const budgetRanges = [
  '$5,000 - $15,000',
  '$15,000 - $30,000',
  '$30,000 - $50,000',
  '$50,000 - $100,000',
  '$100,000+'
];

const timelineOptions = [
  'Within 1 month',
  '1-3 months',
  '3-6 months',
  '6-12 months',
  'More than 1 year'
];

const styleOptions = [
  'Modern',
  'Traditional',
  'Scandinavian',
  'Industrial',
  'Bohemian',
  'Minimalist',
  'Farmhouse',
  'Art Deco'
];

export default function AIOnboardingFlow({ 
  isOpen, 
  projectName, 
  onClose, 
  onComplete 
}: AIOnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<ProjectData>>({
    name: projectName,
    projectType: '',
    rooms: [],
    budget: '',
    timeline: '',
    location: '',
    style: []
  });

  const totalSteps = 6;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(formData as ProjectData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateFormData = (field: keyof ProjectData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleRoom = (room: string) => {
    const currentRooms = formData.rooms || [];
    if (currentRooms.includes(room)) {
      updateFormData('rooms', currentRooms.filter(r => r !== room));
    } else {
      updateFormData('rooms', [...currentRooms, room]);
    }
  };

  const toggleStyle = (style: string) => {
    const currentStyles = formData.style || [];
    if (currentStyles.includes(style)) {
      updateFormData('style', currentStyles.filter(s => s !== style));
    } else {
      updateFormData('style', [...currentStyles, style]);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <FaRobot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">{projectName}</h1>
              <p className="text-sm text-gray-600">Step {currentStep} of {totalSteps}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FaTimes className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-8">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
              animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Setup Step {currentStep}</h2>
          <p className="text-gray-600">Configuring your project preferences...</p>
        </div>

        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600"
          >
            {currentStep === totalSteps ? 'Complete' : 'Next'}
            <FaArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
} 