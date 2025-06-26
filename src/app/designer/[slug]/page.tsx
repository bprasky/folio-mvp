'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { FaEye, FaHeart, FaShare, FaMapMarkerAlt, FaCalendarAlt, FaTag } from 'react-icons/fa';

interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  client: string;
  designerId: string;
  images: Array<{
    id: string;
    url: string;
    name: string;
    room: string;
    tags: any[];
  }>;
  createdAt: string;
  updatedAt: string;
  status: string;
  visibility: string;
  metrics: {
    views?: number;
    saves?: number;
    shares?: number;
  };
}

interface Designer {
  id: string;
  name: string;
  bio: string;
  profileImage: string;
  folders: string[];
  events: string[];
  metrics: {
    savedProducts: number;
    events: number;
    followers: number;
  };
}

export default function DesignerProfilePage() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [designer, setDesigner] = useState<Designer | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDesignerData = async () => {
      try {
        setLoading(true);
        
        // Fetch designers list to find the designer by slug
        const designersResponse = await fetch('/api/admin/designers');
        const designers = await designersResponse.json();
        
        // Find designer by slug (converting name to slug format)
        const foundDesigner = designers.find((d: Designer) => 
          d.name.toLowerCase().replace(/\s+/g, '-') === slug
        );
        
        if (!foundDesigner) {
          setError('Designer not found');
          return;
        }
        
        setDesigner(foundDesigner);
        
        // Fetch projects for this designer
        const projectsResponse = await fetch(`/api/projects?designerId=${foundDesigner.id}`);
        const designerProjects = await projectsResponse.json();
        
        setProjects(designerProjects);
      } catch (err) {
        console.error('Error fetching designer data:', err);
        setError('Failed to load designer profile');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchDesignerData();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading designer profile...</p>
        </div>
      </div>
    );
  }

  if (error || !designer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Designer Not Found</h1>
          <p className="text-gray-600 mb-8">{error || 'The designer profile you\'re looking for doesn\'t exist.'}</p>
          <Link 
            href="/community"
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Browse All Designers
          </Link>
        </div>
      </div>
    );
  }

  const getProjectCoverImage = (project: Project) => {
    return project.images && project.images.length > 0 
      ? project.images[0].url 
      : 'https://source.unsplash.com/800x600?interior,design';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            {/* Profile Image */}
            <div className="relative">
              <Image
                src={designer.profileImage}
                alt={designer.name}
                width={120}
                height={120}
                className="rounded-full object-cover"
              />
            </div>
            
            {/* Designer Info */}
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{designer.name}</h1>
              <p className="text-lg text-gray-600 mb-4">{designer.bio}</p>
              
              {/* Stats */}
              <div className="flex flex-wrap gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <FaHeart className="text-red-500" />
                  <span>{designer.metrics.followers} followers</span>
                </div>
                <div className="flex items-center gap-1">
                  <FaTag className="text-blue-500" />
                  <span>{designer.metrics.savedProducts} saved products</span>
                </div>
                <div className="flex items-center gap-1">
                  <FaCalendarAlt className="text-green-500" />
                  <span>{designer.metrics.events} events</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Projects</h2>
          <p className="text-gray-600">{projects.length} published projects</p>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FaMapMarkerAlt className="mx-auto text-4xl" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600">This designer hasn't published any projects yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <div key={project.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Project Image */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={getProjectCoverImage(project)}
                    alt={project.name}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                  {project.status === 'draft' && (
                    <div className="absolute top-3 left-3 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                      Draft
                    </div>
                  )}
                </div>
                
                {/* Project Info */}
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 capitalize">
                    {project.name}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {project.description.slice(0, 120)}...
                  </p>
                  
                  {/* Project Meta */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span className="bg-gray-100 px-2 py-1 rounded capitalize">
                      {project.category}
                    </span>
                    <span>{formatDate(project.createdAt)}</span>
                  </div>
                  
                  {/* Project Stats */}
                  {project.metrics && (
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                      {project.metrics.views && (
                        <div className="flex items-center gap-1">
                          <FaEye />
                          <span>{project.metrics.views}</span>
                        </div>
                      )}
                      {project.metrics.saves && (
                        <div className="flex items-center gap-1">
                          <FaHeart />
                          <span>{project.metrics.saves}</span>
                        </div>
                      )}
                      {project.metrics.shares && (
                        <div className="flex items-center gap-1">
                          <FaShare />
                          <span>{project.metrics.shares}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* View Project Button */}
                  <Link
                    href={`/project/${project.id}`}
                    className="block w-full text-center bg-black text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    View Project
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 