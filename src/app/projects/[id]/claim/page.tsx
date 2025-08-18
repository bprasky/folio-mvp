'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description?: string;
  vendorOrg?: {
    id: string;
    name: string;
  };
  designerOrg?: {
    id: string;
    name: string;
  };
  owner: {
    id: string;
    name: string;
    email: string;
  };
  rooms: Array<{
    id: string;
    name: string;
    selections: Array<{
      id: string;
      productName?: string;
      vendorName?: string;
      notes?: string;
      photo?: string;
    }>;
  }>;
  selections: Array<{
    id: string;
    productName?: string;
    vendorName?: string;
    notes?: string;
    photo?: string;
  }>;
  isHandoffReady: boolean;
  handoffInvitedAt?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function ProjectClaimPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userOrgs, setUserOrgs] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch project details
        const projectResponse = await fetch(`/api/projects/${projectId}`);
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          setProject(projectData);
        }

        // Fetch current user
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUser(userData);
          
          // Fetch user's organizations
          const orgsResponse = await fetch('/api/organizations?userId=' + (userData?.id || ''));
          if (orgsResponse.ok) {
            const orgsData = await orgsResponse.json();
            setUserOrgs(orgsData);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setMessage('Error loading project details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const handleClaimProject = async () => {
    if (!currentUser) {
      setMessage('Please log in to claim this project');
      return;
    }

    setIsClaiming(true);
    setMessage('');

    try {
      const response = await fetch('/api/projects/handoff', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          designerUserId: currentUser.id,
          designerOrgId: selectedOrgId || undefined,
        }),
      });

      if (response.ok) {
        setMessage('Project claimed successfully! Redirecting...');
        setTimeout(() => {
          router.push(`/projects/${projectId}`);
        }, 2000);
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch (error) {
      setMessage('Error claiming project. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  const downloadSelections = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/export?format=csv`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project?.name}-selections.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading selections:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Project Not Found</h1>
          <p className="text-gray-600 mb-4">The project you're looking for doesn't exist or has been removed.</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-gray-600 mb-4">{project.description}</p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Created by:</span>
              <p className="text-gray-600">{project.owner.name} ({project.owner.email})</p>
            </div>
            {project.vendorOrg && (
              <div>
                <span className="font-medium text-gray-700">Vendor Organization:</span>
                <p className="text-gray-600">{project.vendorOrg.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Project Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Project Summary</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{project.rooms.length}</div>
              <div className="text-sm text-gray-600">Rooms</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{project.selections.length}</div>
              <div className="text-sm text-gray-600">Selections</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {project.isHandoffReady ? 'Ready' : 'Active'}
              </div>
              <div className="text-sm text-gray-600">Status</div>
            </div>
          </div>

          {/* Rooms and Selections Preview */}
          <div className="space-y-4">
            {project.rooms.map((room) => (
              <div key={room.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">{room.name}</h3>
                {room.selections.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {room.selections.slice(0, 4).map((selection) => (
                      <div key={selection.id} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-600">
                          {selection.productName || selection.vendorName || 'Product'}
                        </span>
                      </div>
                    ))}
                    {room.selections.length > 4 && (
                      <div className="text-gray-500 text-sm">
                        +{room.selections.length - 4} more selections
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No selections yet</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Claim Project Section */}
        {project.isHandoffReady && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Claim This Project</h2>
            
            {!currentUser ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">Please log in to claim this project</p>
                <Link 
                  href="/auth/signin" 
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                >
                  Sign In
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Your Organization (Optional)
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No organization</option>
                    {userOrgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleClaimProject}
                    disabled={isClaiming}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isClaiming ? 'Claiming Project...' : 'Claim Project Ownership'}
                  </button>
                  
                  <button
                    onClick={downloadSelections}
                    className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
                  >
                    Download Selections (CSV)
                  </button>
                </div>

                {message && (
                  <div className={`p-3 rounded-md ${
                    message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {message}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-md p-6 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">Ready to Organize Your Selections?</h2>
          <p className="mb-4 opacity-90">
            Take ownership of this project to organize your selections, add additional products, 
            and generate client-ready presentations instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/auth/signin" 
              className="bg-white text-blue-600 px-6 py-2 rounded-md hover:bg-gray-100 font-medium"
            >
              Get Started with Folio
            </Link>
            <button
              onClick={downloadSelections}
              className="border border-white text-white px-6 py-2 rounded-md hover:bg-white hover:text-blue-600 font-medium"
            >
              Download Selections
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 