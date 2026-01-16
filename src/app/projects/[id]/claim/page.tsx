'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

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
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="mt-4 folio-body text-[var(--text-secondary)]">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="folio-h2 text-[var(--text-primary)] mb-4">Project Not Found</h1>
          <p className="folio-body text-[var(--text-secondary)] mb-4">The project you're looking for doesn't exist or has been removed.</p>
          <Link href="/" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <RidgeCard className="p-6 mb-6">
          <h1 className="folio-h1 text-[var(--text-primary)] mb-2">{project.name}</h1>
          {project.description && (
            <p className="folio-body text-[var(--text-secondary)] mb-4">{project.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="folio-ui font-medium text-[var(--text-primary)]">Created by:</span>
              <p className="folio-meta text-[var(--text-secondary)]">{project.owner.name} ({project.owner.email})</p>
            </div>
            {project.vendorOrg && (
              <div>
                <span className="folio-ui font-medium text-[var(--text-primary)]">Vendor Organization:</span>
                <p className="folio-meta text-[var(--text-secondary)]">{project.vendorOrg.name}</p>
              </div>
            )}
          </div>
        </RidgeCard>

        {/* Project Summary */}
        <RidgeCard className="p-6 mb-6">
          <h2 className="folio-h2 text-[var(--text-primary)] mb-4">Project Summary</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-[var(--bg-base)] rounded-lg border border-[var(--border)]">
              <div className="folio-h2 text-[var(--accent)]">{project.rooms.length}</div>
              <div className="folio-meta text-[var(--text-secondary)]">Rooms</div>
            </div>
            <div className="text-center p-4 bg-[var(--bg-base)] rounded-lg border border-[var(--border)]">
              <div className="folio-h2 text-[var(--accent)]">{project.selections.length}</div>
              <div className="folio-meta text-[var(--text-secondary)]">Selections</div>
            </div>
            <div className="text-center p-4 bg-[var(--bg-base)] rounded-lg border border-[var(--border)]">
              <div className="folio-h2 text-[var(--accent)]">
                {project.isHandoffReady ? 'Ready' : 'Active'}
              </div>
              <div className="folio-meta text-[var(--text-secondary)]">Status</div>
            </div>
          </div>

          {/* Rooms and Selections Preview */}
          <div className="space-y-4">
            {project.rooms.map((room) => (
              <div key={room.id} className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-base)]">
                <h3 className="folio-h3 text-[var(--text-primary)] mb-2">{room.name}</h3>
                {room.selections.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {room.selections.slice(0, 4).map((selection) => (
                      <div key={selection.id} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-[var(--accent)] rounded-full"></div>
                        <span className="folio-meta text-[var(--text-secondary)]">
                          {selection.productName || selection.vendorName || 'Product'}
                        </span>
                      </div>
                    ))}
                    {room.selections.length > 4 && (
                      <div className="folio-meta text-[var(--text-tertiary)]">
                        +{room.selections.length - 4} more selections
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="folio-meta text-[var(--text-tertiary)]">No selections yet</p>
                )}
              </div>
            ))}
          </div>
        </RidgeCard>

        {/* Claim Project Section */}
        {project.isHandoffReady && (
          <RidgeCard className="p-6 mb-6">
            <h2 className="folio-h2 text-[var(--text-primary)] mb-4">Claim This Project</h2>

            {!currentUser ? (
              <div className="text-center py-8">
                <p className="folio-body text-[var(--text-secondary)] mb-4">Please log in to claim this project</p>
                <Link href="/auth/signin">
                  <Button variant="accent">
                    Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block folio-ui font-medium text-[var(--text-primary)] mb-2">
                    Select Your Organization (Optional)
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
                  <Button
                    onClick={handleClaimProject}
                    disabled={isClaiming}
                    variant="accent"
                    className="flex-1"
                  >
                    {isClaiming ? 'Claiming Project...' : 'Claim Project Ownership'}
                  </Button>

                  <Button
                    onClick={downloadSelections}
                    variant="outline"
                    className="flex-1"
                  >
                    Download Selections (CSV)
                  </Button>
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
          </RidgeCard>
        )}

        {/* CTA Section */}
        <RidgeCard className="p-6 bg-[var(--bg-elevated)] text-center">
          <h2 className="folio-h2 text-[var(--text-primary)] mb-2">Ready to Organize Your Selections?</h2>
          <p className="folio-body text-[var(--text-secondary)] mb-4">
            Take ownership of this project to organize your selections, add additional products,
            and generate client-ready presentations instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signin">
              <Button variant="accent">
                Get Started with Folio
              </Button>
            </Link>
            <Button
              onClick={downloadSelections}
              variant="outline"
            >
              Download Selections
            </Button>
          </div>
        </RidgeCard>
      </div>
    </div>
  );
}
