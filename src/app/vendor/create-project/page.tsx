'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { FaBriefcase, FaMapMarkerAlt, FaTags, FaSave, FaArrowLeft } from 'react-icons/fa';

const PROJECT_TYPES = [
  'Residential',
  'Commercial',
  'Hospitality',
  'Healthcare',
  'Educational',
  'Retail',
  'Office',
  'Restaurant',
  'Other'
];

const STYLE_TAGS = [
  'Mid-century Modern',
  'Japandi',
  'Coastal',
  'Scandinavian',
  'Industrial',
  'Bohemian',
  'Minimalist',
  'Traditional',
  'Contemporary',
  'Art Deco',
  'Rustic',
  'Modern Farmhouse',
  'Mediterranean',
  'Tropical',
  'Urban',
  'Luxury',
  'Eco-friendly',
  'Smart Home'
];

export default function VendorCreateProjectPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: '',
    location: '',
    description: '',
    styleTags: [] as string[]
  });

  // Check authentication status
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session?.user?.id) {
    // Redirect to signin page if not authenticated
    router.push('/auth/signin');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to create projects</p>
        </div>
      </div>
    );
  }

  // Check if user is a vendor
  if (session.user.role !== 'VENDOR') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Only vendors can create projects</p>
          <p className="text-sm text-gray-500 mt-2">
            Current role: {session.user.role}
          </p>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStyleTagToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      styleTags: prev.styleTags.includes(tag)
        ? prev.styleTags.filter(t => t !== tag)
        : [...prev.styleTags, tag]
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) return 'Project title is required';
    if (!formData.type) return 'Project type is required';
    if (!formData.location.trim()) return 'Location is required';
    if (!formData.description.trim()) return 'Description is required';
    if (formData.styleTags.length === 0) return 'Please select at least one style tag';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      alert(validationError);
      return;
    }

    // Debug session data
    console.log('DEBUG: Session data:', session);
    console.log('DEBUG: Session user:', session?.user);
    console.log('DEBUG: Session user ID:', session?.user?.id);

    if (!session?.user?.id) {
      alert('No user session found. Please log in again.');
      return;
    }

    setIsLoading(true);

    try {
      const requestBody = {
        ...formData,
        // Remove vendorId - it will be set from session on the server
      };
      
      console.log('DEBUG: Sending request with body:', requestBody);

      const response = await fetch('/api/vendor/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const project = await response.json();
        console.log('Vendor project created successfully:', project);
        router.push(`/vendor/project/${project.id}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          alert('You must be signed in as VENDOR or ADMIN.');
        } else if (response.status === 403) {
          alert('Your role is not permitted to create vendor projects.');
        } else {
          alert(`Error: ${errorData.error || 'Failed to create project'}`);
        }
      }
    } catch (error) {
      console.error('Error creating vendor project:', error);
      alert('Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      
      
      <div className="flex-1 lg:ml-20 xl:ml-56 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => router.back()}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Create New Vendor Project</h1>
                <p className="text-gray-600">Set up your project header and get started</p>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-lg p-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Project Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Project Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter project title"
                    required
                  />
                </div>

                {/* Project Type */}
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                    Project Type *
                  </label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  >
                    <option value="">Select project type</option>
                    {PROJECT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <div className="relative">
                    <FaMapMarkerAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="City, State"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Project Description *
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    placeholder="Describe your project vision, goals, and key requirements..."
                    required
                  />
                </div>

                {/* Style Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Style Tags * (Select all that apply)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {STYLE_TAGS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleStyleTagToggle(tag)}
                        className={`p-2 text-sm rounded-lg border transition-all ${
                          formData.styleTags.includes(tag)
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  {formData.styleTags.length > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      Selected: {formData.styleTags.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-4 px-6 rounded-xl font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating Project...
                  </>
                ) : (
                  <>
                    <FaSave className="w-5 h-5" />
                    Create Project
                  </>
                )}
              </button>
            </div>
          </motion.form>

          {/* Help Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-gray-500">
              After creating your project, you'll be able to add rooms, upload inspiration images, and organize your selections.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
} 