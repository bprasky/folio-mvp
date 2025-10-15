'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Package, User, Clock, ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface VisitLandingProps {
  visit: {
    id: string;
    token: string;
    note?: string | null;
    expiresAt?: Date | null;
    createdAt: Date;
    vendorId: string;
    projectId?: string | null;
    designerId?: string | null;
    expired: boolean;
    vendor?: {
      id: string;
      name?: string | null;
      email?: string | null;
    } | null;
    project?: {
      id: string;
      title?: string | null;
      city?: string | null;
      regionState?: string | null;
    } | null;
    products?: Array<{
      id: string;
      productName?: string | null;
      vendorName?: string | null;
      photo?: string | null;
      colorFinish?: string | null;
      slotKey?: string | null;
    }>;
  };
  session: any;
}

export default function VisitLanding({ visit, session }: VisitLandingProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveToProject = async () => {
    if (!session?.user) {
      // Redirect to login
      router.push(`/auth/signin?callbackUrl=/visit/${visit.token}`);
      return;
    }

    setIsSaving(true);
    try {
      // Redirect to project creation or selection
      if (visit.projectId) {
        router.push(`/project/${visit.projectId}`);
      } else {
        router.push(`/projects/new?visitToken=${visit.token}`);
      }
    } catch (error) {
      console.error('Error saving to project:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (visit.expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Visit Expired</CardTitle>
            <CardDescription>
              This vendor visit link has expired and is no longer available.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push('/')} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Vendor Visit
          </h1>
          <p className="text-gray-600">
            You've been invited to view products and specifications from{' '}
            <span className="font-medium">{visit.vendor?.name || 'a vendor'}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vendor Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Vendor Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">{visit.vendor?.name || 'Unknown Vendor'}</p>
                  {visit.vendor?.email && (
                    <p className="text-sm text-gray-600">{visit.vendor.email}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Project Info */}
            {visit.project && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Project Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">{visit.project.title || 'Untitled Project'}</p>
                    {(visit.project.city || visit.project.regionState) && (
                      <p className="text-sm text-gray-600">
                        {visit.project.city && visit.project.regionState
                          ? `${visit.project.city}, ${visit.project.regionState}`
                          : visit.project.city || visit.project.regionState}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggested Products */}
            {visit.products && visit.products.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Suggested Products
                  </CardTitle>
                  <CardDescription>
                    Products selected for this project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visit.products.map((product) => (
                      <div key={product.id} className="border rounded-lg p-4">
                        <div className="flex gap-3">
                          {product.photo && (
                            <div className="w-16 h-16 relative flex-shrink-0">
                              <Image
                                src={product.photo}
                                alt={product.productName || 'Product'}
                                fill
                                className="object-cover rounded"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {product.productName || 'Unnamed Product'}
                            </p>
                            <p className="text-xs text-gray-600 truncate">
                              {product.vendorName}
                            </p>
                            {product.colorFinish && (
                              <p className="text-xs text-gray-500 truncate">
                                {product.colorFinish}
                              </p>
                            )}
                            {product.slotKey && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {product.slotKey}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Note */}
            {visit.note && (
              <Card>
                <CardHeader>
                  <CardTitle>Message from Vendor</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{visit.note}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Card */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>
                  Save this visit to your projects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {session?.user ? (
                  <Button 
                    onClick={handleSaveToProject} 
                    disabled={isSaving}
                    className="w-full"
                  >
                    {isSaving ? 'Saving...' : 'Save to Project'}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button 
                      onClick={handleSaveToProject}
                      className="w-full"
                    >
                      Sign In to Save
                    </Button>
                    <p className="text-xs text-gray-500 text-center">
                      You'll need to sign in to save this visit to your projects
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Visit Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Visit Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Created:</span>
                  <span>{new Date(visit.createdAt).toLocaleDateString()}</span>
                </div>
                {visit.expiresAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Expires:</span>
                    <span>{new Date(visit.expiresAt).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant="outline">Active</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

