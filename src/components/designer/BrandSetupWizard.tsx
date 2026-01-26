'use client';

// NOTE (designer onboarding):
// Brand setup wizard component for designer brand identity.
// Used in onboarding flow and can be accessed later from settings.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DesignerFlowErrorBoundary } from '@/components/ui/DesignerFlowErrorBoundary';
import { saveBrandProfile, skipBrandSetup } from '@/app/actions/brandSetup';

interface BrandSetupWizardProps {
  brandProfile?: {
    id: string;
    logoImageUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
    fontHeading: string | null;
    fontBody: string | null;
    websiteUrl: string | null;
  } | null;
  isEditMode?: boolean;
}

export function BrandSetupWizard({ brandProfile, isEditMode = false }: BrandSetupWizardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    logoImageUrl: brandProfile?.logoImageUrl || '',
    primaryColor: brandProfile?.primaryColor || '',
    secondaryColor: brandProfile?.secondaryColor || '',
    accentColor: brandProfile?.accentColor || '',
    fontHeading: brandProfile?.fontHeading || '',
    fontBody: brandProfile?.fontBody || '',
    websiteUrl: brandProfile?.websiteUrl || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await saveBrandProfile({
        logoImageUrl: formData.logoImageUrl || null,
        primaryColor: formData.primaryColor || null,
        secondaryColor: formData.secondaryColor || null,
        accentColor: formData.accentColor || null,
        fontHeading: formData.fontHeading || null,
        fontBody: formData.fontBody || null,
        websiteUrl: formData.websiteUrl || null,
      });

      if (result.success) {
        if (isEditMode) {
          router.refresh();
        } else {
          router.push('/designer/projects/new');
        }
      } else {
        alert(result.error || 'Failed to save brand profile');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error saving brand profile:', error);
      alert('Failed to save brand profile');
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      const result = await skipBrandSetup();
      if (result.success) {
        router.push('/designer/projects/new');
      } else {
        alert(result.error || 'Failed to skip setup');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error skipping brand setup:', error);
      alert('Failed to skip setup');
      setIsLoading(false);
    }
  };

  return (
    <DesignerFlowErrorBoundary context="brand-setup">
      <Card className="w-full max-w-2xl">
        <CardHeader>
        <CardTitle>
          {isEditMode ? 'Edit Brand Identity' : 'Set up your studio identity'}
        </CardTitle>
        <CardDescription>
          {isEditMode
            ? 'Update your brand colors, fonts, and logo to personalize your projects.'
            : 'Upload your logo and colors so your projects on Folio feel like your studio, not a generic grid. You can always change this later.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label htmlFor="logoImageUrl">Logo Image URL</Label>
            <Input
              id="logoImageUrl"
              type="url"
              placeholder="https://example.com/logo.png"
              value={formData.logoImageUrl}
              onChange={(e) => setFormData({ ...formData, logoImageUrl: e.target.value })}
            />
            <p className="text-xs text-[var(--text-tertiary)]">
              Paste a URL to your logo image. Image upload coming soon.
            </p>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={formData.primaryColor || '#000000'}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  type="text"
                  placeholder="#000000"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={formData.secondaryColor || '#666666'}
                  onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  type="text"
                  placeholder="#666666"
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="accentColor"
                  type="color"
                  value={formData.accentColor || '#FF6B6B'}
                  onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  type="text"
                  placeholder="#FF6B6B"
                  value={formData.accentColor}
                  onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>
          </div>

          {/* Fonts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fontHeading">Heading Font</Label>
              <Input
                id="fontHeading"
                type="text"
                placeholder="e.g. Suisse Intl, Inter, Helvetica"
                value={formData.fontHeading}
                onChange={(e) => setFormData({ ...formData, fontHeading: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fontBody">Body Font</Label>
              <Input
                id="fontBody"
                type="text"
                placeholder="e.g. Inter, Georgia, Arial"
                value={formData.fontBody}
                onChange={(e) => setFormData({ ...formData, fontBody: e.target.value })}
              />
            </div>
          </div>

          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website URL (optional)</Label>
            <Input
              id="websiteUrl"
              type="url"
              placeholder="https://yourstudio.com"
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
            />
            <p className="text-xs text-[var(--text-tertiary)]">
              Used later for AI brand scanning and analysis.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save & Continue'}
            </Button>
            {!isEditMode && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={isLoading}
              >
                Skip for now
              </Button>
            )}
            </div>
          </form>
        </CardContent>
      </Card>
    </DesignerFlowErrorBoundary>
  );
}

