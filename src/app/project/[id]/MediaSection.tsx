'use client';

import { FaUpload, FaImages, FaPlus } from 'react-icons/fa';

interface MediaSectionProps {
  project: {
    id: string;
    title: string;
  };
  isOwner: boolean;
}

export default function MediaSection({ project, isOwner }: MediaSectionProps) {
  return (
    <div className="space-y-10">
      {/* Media Gallery Section */}
      <section className="bg-white p-8 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <FaImages className="w-8 h-8 text-blue-600" />
            Project Media
          </h2>
          {isOwner && (
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <FaUpload className="w-4 h-4" />
              Upload Media
            </button>
          )}
        </div>
        
        {/* Media Grid Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder for media items */}
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
            <div className="text-center text-gray-500">
              <FaImages className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No media uploaded yet</p>
            </div>
          </div>
          
          {isOwner && (
            <div className="aspect-video bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors cursor-pointer">
              <div className="text-center text-gray-500">
                <FaPlus className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Add Media</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Project Images Section */}
      <section className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-3xl font-bold mb-6">Project Images</h2>
        <div className="text-center py-12 text-gray-500">
          <FaImages className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No images uploaded yet</p>
          {isOwner && (
            <div className="space-y-2">
              <p className="text-sm">Upload images to showcase your project progress and final results.</p>
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <FaUpload className="w-4 h-4" />
                Upload Images
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Documents Section */}
      <section className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-3xl font-bold mb-6">Project Documents</h2>
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No documents uploaded yet</p>
          {isOwner && (
            <div className="space-y-2">
              <p className="text-sm">Upload project documents, specifications, and other files.</p>
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                <FaUpload className="w-4 h-4" />
                Upload Documents
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

