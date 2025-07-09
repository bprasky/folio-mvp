'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CheckCircle, 
  Tag, 
  Sparkles, 
  ArrowRight, 
  Image as ImageIcon,
  Users,
  Globe
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface DesignerData {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  website?: string;
  designerProfile?: {
    about?: string;
    logo?: string;
    team?: string;
    specialties: string[];
  };
  projects: Array<{
    id: string;
    name: string;
    description?: string;
    images: Array<{
      id: string;
      url: string;
    }>;
  }>;
}

export default function OnboardingCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams?.get('userId');
  
  const [designerData, setDesignerData] = useState<DesignerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchDesignerData();
    }
  }, [userId]);

  const fetchDesignerData = async () => {
    try {
      const response = await fetch(`/api/designers/${userId}/onboarding`);
      if (response.ok) {
        const data = await response.json();
        setDesignerData(data);
      }
    } catch (error) {
      console.error('Error fetching designer data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-folio-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-folio-accent mx-auto mb-4"></div>
          <p className="text-folio-text">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!designerData) {
    return (
      <div className="min-h-screen bg-folio-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-folio-text">Profile not found</p>
        </div>
      </div>
    );
  }

  const teamMembers = designerData.designerProfile?.team 
    ? JSON.parse(designerData.designerProfile.team) 
    : [];

  return (
    <div className="min-h-screen bg-folio-background">
      {/* Header */}
      <div className="bg-white border-b border-folio-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-folio-accent rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-folio-text">Welcome to Folio!</h1>
                <p className="text-folio-border">Your profile has been created successfully</p>
              </div>
            </div>
            <Link
              href="/designer/profile"
              className="bg-folio-accent text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              View Profile
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-folio-border p-6 sticky top-8">
              <div className="text-center mb-6">
                {designerData.designerProfile?.logo ? (
                  <Image
                    src={designerData.designerProfile.logo}
                    alt={designerData.name}
                    width={80}
                    height={80}
                    className="rounded-full mx-auto mb-4"
                  />
                ) : (
                  <div className="w-20 h-20 bg-folio-muted rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Users className="w-8 h-8 text-folio-border" />
                  </div>
                )}
                <h2 className="text-xl font-semibold text-folio-text">{designerData.name}</h2>
                {designerData.website && (
                  <a
                    href={designerData.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-folio-accent hover:underline text-sm flex items-center justify-center mt-1"
                  >
                    <Globe className="w-4 h-4 mr-1" />
                    Visit Website
                  </a>
                )}
              </div>

              {designerData.designerProfile?.about && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-folio-text mb-2">About</h3>
                  <p className="text-sm text-folio-border leading-relaxed">
                    {designerData.designerProfile.about}
                  </p>
                </div>
              )}

              {designerData.designerProfile?.specialties.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-folio-text mb-2">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {designerData.designerProfile.specialties.map((specialty, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-folio-muted text-folio-text text-xs rounded-full"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {teamMembers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-folio-text mb-2">Team</h3>
                  <div className="space-y-2">
                    {teamMembers.slice(0, 3).map((member: any, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        {member.image && (
                          <Image
                            src={member.image}
                            alt={member.name}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-folio-text truncate">{member.name}</p>
                          <p className="text-xs text-folio-border truncate">{member.role}</p>
                        </div>
                      </div>
                    ))}
                    {teamMembers.length > 3 && (
                      <p className="text-xs text-folio-border">
                        +{teamMembers.length - 3} more team members
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-folio-accent bg-opacity-10 border border-folio-accent rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Tag className="w-5 h-5 text-folio-accent mt-0.5" />
                  <div>
                    <h4 className="font-medium text-folio-text mb-1">Ready to Earn</h4>
                    <p className="text-sm text-folio-border mb-3">
                      Start tagging products in your portfolio to begin earning commissions.
                    </p>
                    <Link
                      href={`/designer/project-tagging`}
                      className="inline-flex items-center text-sm text-folio-accent hover:underline"
                    >
                      Start Tagging
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Projects */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-folio-text mb-2">Your Portfolio</h2>
              <p className="text-folio-border">
                We've imported {designerData.projects.length} projects from your website. 
                Start tagging products to unlock earnings!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {designerData.projects.map((project) => (
                <div key={project.id} className="bg-white rounded-xl shadow-sm border border-folio-border overflow-hidden">
                  {project.images.length > 0 && (
                    <div className="relative h-48 bg-folio-muted">
                      <Image
                        src={project.images[0].url}
                        alt={project.name}
                        fill
                        className="object-cover"
                      />
                      {project.images.length > 1 && (
                        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                          +{project.images.length - 1} more
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-folio-text mb-2">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-folio-border mb-4 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-folio-border">
                        <ImageIcon className="w-4 h-4 mr-1" />
                        {project.images.length} images
                      </div>
                                          <Link
                      href="/designer/project-tagging"
                      className="inline-flex items-center text-sm text-folio-accent hover:underline"
                    >
                      Tag Products
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Next Steps */}
            <div className="mt-8 bg-gradient-to-r from-folio-accent to-purple-600 rounded-xl p-6 text-white">
              <div className="flex items-start space-x-4">
                <Sparkles className="w-8 h-8 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Your Next Steps</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-sm font-medium">
                        1
                      </div>
                      <span>Tag products in your portfolio images</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-sm font-medium">
                        2
                      </div>
                      <span>Share your portfolio with clients</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-sm font-medium">
                        3
                      </div>
                      <span>Start earning commissions on product sales</span>
                    </div>
                  </div>
                  <div className="mt-6">
                    <Link
                      href="/designer/project-tagging"
                      className="inline-flex items-center bg-white text-folio-accent px-6 py-3 rounded-lg font-medium hover:bg-opacity-90 transition-colors"
                    >
                      Start Tagging Now
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 