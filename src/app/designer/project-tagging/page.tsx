'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaTag, FaImage, FaUpload, FaCheck, FaInfoCircle } from 'react-icons/fa';
import Link from 'next/link';
import AdvancedTagProducts from '@/components/AdvancedTagProducts';

interface Project {
  id: string;
  name: string;
  description?: string;
  images: Array<{
    id: string;
    url: string;
  }>;
}

export default function ProjectTaggingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ id: string; url: string; name: string } | null>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's imported projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/projects?includeDrafts=true');
        if (res.ok) {
          const data = await res.json();
          const userProjects = Array.isArray(data) ? data : [];
          setProjects(userProjects);
          
          // Auto-select first project if available
          if (userProjects.length > 0) {
            setSelectedProject(userProjects[0]);
            if (userProjects[0].images.length > 0) {
              setSelectedImage({
                id: userProjects[0].images[0].id,
                url: userProjects[0].images[0].url,
                name: userProjects[0].name
              });
            }
          }
        } else {
          setError('Failed to load your projects');
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Failed to load your projects');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleTagsUpdate = (updatedTags: any[]) => {
    setTags(updatedTags);
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    if (project.images.length > 0) {
      setSelectedImage({
        id: project.images[0].id,
        url: project.images[0].url,
        name: project.name
      });
    } else {
      setSelectedImage(null);
    }
    setTags([]);
  };

  const handleImageSelect = (image: { id: string; url: string }) => {
    setSelectedImage({
      id: image.id,
      url: image.url,
      name: selectedProject?.name || 'Project Image'
    });
    setTags([]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaInfoCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Projects</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link 
            href="/designer" 
            className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            <FaArrowLeft className="w-4 h-4 mr-2" />
            Back to Designer Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaImage className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Projects Found</h2>
          <p className="text-gray-600 mb-4">
            You need to have imported projects from your website to start tagging products.
          </p>
          <div className="space-y-3">
            <Link 
              href="/designer" 
              className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
              <FaArrowLeft className="w-4 h-4 mr-2" />
              Back to Designer Dashboard
            </Link>
            <div className="text-sm text-gray-500">
              <p>If you haven't imported your portfolio yet, please:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Complete the onboarding process</li>
                <li>Import your website portfolio</li>
                <li>Return here to start tagging</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link 
              href="/designer" 
              className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4 transition-colors"
            >
              <FaArrowLeft className="w-4 h-4 mr-2" />
              Back to Designer Dashboard
            </Link>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Tag Products in Your Portfolio
                </h1>
                <p className="text-gray-600 text-lg">
                  Click on any part of your project images to tag products and start earning commissions
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{tags.length}</div>
                  <div className="text-sm text-gray-500">Products Tagged</div>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <FaTag className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Project Selection */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Your Project</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <motion.div
                  key={project.id}
                  className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200 ${
                    selectedProject?.id === project.id
                      ? 'border-blue-500 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleProjectSelect(project)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {project.images.length > 0 ? (
                    <div className="aspect-video bg-gray-100">
                      <img
                        src={project.images[0].url}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      <FaImage className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">{project.name}</h3>
                    <p className="text-gray-600 text-xs mb-2">
                      {project.images.length} image{project.images.length !== 1 ? 's' : ''}
                    </p>
                    {project.description && (
                      <p className="text-gray-600 text-xs line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  
                  {selectedProject?.id === project.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center">
                      <FaCheck className="w-3 h-3" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Image Selection */}
          {selectedProject && selectedProject.images.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Image to Tag</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedProject.images.map((image) => (
                  <motion.div
                    key={image.id}
                    className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200 ${
                      selectedImage?.id === image.id
                        ? 'border-blue-500 shadow-lg'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleImageSelect(image)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <img
                      src={image.url}
                      alt={`${selectedProject.name} - Image`}
                      className="w-full h-full object-cover"
                    />
                    
                    {selectedImage?.id === image.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center">
                        <FaCheck className="w-3 h-3" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Main Tagging Interface */}
          {selectedImage && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Tag Products in: {selectedImage.name}
                </h2>
                <p className="text-gray-600">
                  Click anywhere on the image below to tag products from our vendor catalog. 
                  Hover over existing tags to see product details.
                </p>
              </div>

              {/* Advanced Tagging Component */}
              <AdvancedTagProducts
                imageUrl={selectedImage.url}
                projectId={selectedProject?.id || 'unknown'}
                onTagsUpdate={handleTagsUpdate}
                isEditable={true}
              />
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <FaImage className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">1. Select Your Project</h3>
              <p className="text-gray-600 text-sm">
                Choose from your imported portfolio projects to start tagging products.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <FaTag className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">2. Click to Tag</h3>
              <p className="text-gray-600 text-sm">
                Click on any furniture, decor, or fixture in your project images to tag it with a product.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <FaCheck className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">3. Earn Commissions</h3>
              <p className="text-gray-600 text-sm">
                Tagged products are automatically saved and you'll earn commissions on sales.
              </p>
            </div>
          </div>

          {/* Features Highlight */}
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">✨ Why Tag Your Portfolio?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Earn Commissions:</strong> Get paid for every product sale from your tagged images
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Client Engagement:</strong> Turn your portfolio into a shoppable experience
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Professional Credibility:</strong> Show clients exactly what products you used
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Analytics & Insights:</strong> Track which products perform best in your projects
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 