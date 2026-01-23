'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface StudioDetailsModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  initialData?: {
    foundedYear?: number | null;
    teamSizeRange?: string | null;
    services?: string[];
    projectTypes?: string[];
    serviceRegions?: string[];
    memberships?: string[];
    certifications?: string[];
  };
  onSuccess: () => void;
}

const TEAM_SIZES = [
  { value: 'SOLO', label: 'Solo (1 person)' },
  { value: 'SMALL_2_5', label: 'Small (2-5)' },
  { value: 'MEDIUM_6_15', label: 'Medium (6-15)' },
  { value: 'LARGE_16_50', label: 'Large (16-50)' },
  { value: 'ENTERPRISE_50_PLUS', label: 'Enterprise (50+)' }
];

const SERVICE_OPTIONS = [
  'Full-Service Design',
  'Consultation Only',
  'E-Design',
  'Project Management',
  'Purchasing Services',
  'Staging',
  'Art Curation'
];

const PROJECT_TYPE_OPTIONS = [
  'Residential',
  'Commercial',
  'Hospitality',
  'Retail',
  'Healthcare',
  'Multi-Family',
  'Historic Renovation',
  'New Construction'
];

const MEMBERSHIP_OPTIONS = ['ASID', 'AIA', 'NKBA', 'IIDA', 'IDS', 'IFDA', 'Other'];

const CERTIFICATION_OPTIONS = [
  'LEED',
  'WELL',
  'Passive House',
  'NCIDQ',
  'Living Building Challenge',
  'SITES',
  'Other'
];

export function StudioDetailsModal({
  open,
  onClose,
  orgId,
  initialData,
  onSuccess
}: StudioDetailsModalProps) {
  const [foundedYear, setFoundedYear] = useState(initialData?.foundedYear?.toString() || '');
  const [teamSizeRange, setTeamSizeRange] = useState(initialData?.teamSizeRange || '');
  const [services, setServices] = useState<string[]>(initialData?.services || []);
  const [projectTypes, setProjectTypes] = useState<string[]>(initialData?.projectTypes || []);
  const [serviceRegions, setServiceRegions] = useState(
    initialData?.serviceRegions?.join(', ') || ''
  );
  const [memberships, setMemberships] = useState<string[]>(initialData?.memberships || []);
  const [certifications, setCertifications] = useState<string[]>(
    initialData?.certifications || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleArrayValue = (
    arr: string[],
    value: string,
    setter: (val: string[]) => void
  ) => {
    if (arr.includes(value)) {
      setter(arr.filter((v) => v !== value));
    } else {
      setter([...arr, value]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/orgs/${orgId}/studio-details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foundedYear: foundedYear ? parseInt(foundedYear) : null,
          teamSizeRange: teamSizeRange || null,
          services,
          projectTypes,
          serviceRegions: serviceRegions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          memberships,
          certifications
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save studio details');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Studio details error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Georgia, serif' }}>Studio Details</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {error && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'rgb(220, 38, 38)' }}
            >
              {error}
            </div>
          )}

          {/* Founded Year */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Year Founded</label>
            <Input
              type="number"
              placeholder="e.g., 2015"
              value={foundedYear}
              onChange={(e) => setFoundedYear(e.target.value)}
              min="1900"
              max={new Date().getFullYear()}
            />
          </div>

          {/* Team Size */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Team Size</label>
            <div className="flex flex-wrap gap-2">
              {TEAM_SIZES.map((size) => (
                <Badge
                  key={size.value}
                  variant={teamSizeRange === size.value ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setTeamSizeRange(size.value)}
                >
                  {size.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Services Offered</label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map((service) => (
                <Badge
                  key={service}
                  variant={services.includes(service) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayValue(services, service, setServices)}
                >
                  {service}
                </Badge>
              ))}
            </div>
          </div>

          {/* Project Types */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Types</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPE_OPTIONS.map((type) => (
                <Badge
                  key={type}
                  variant={projectTypes.includes(type) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayValue(projectTypes, type, setProjectTypes)}
                >
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          {/* Service Regions */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Service Regions</label>
            <Input
              placeholder="e.g., San Francisco Bay Area, Los Angeles"
              value={serviceRegions}
              onChange={(e) => setServiceRegions(e.target.value)}
            />
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Separate multiple regions with commas
            </p>
          </div>

          {/* Memberships */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Professional Memberships</label>
            <div className="flex flex-wrap gap-2">
              {MEMBERSHIP_OPTIONS.map((membership) => (
                <Badge
                  key={membership}
                  variant={memberships.includes(membership) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayValue(memberships, membership, setMemberships)}
                >
                  {membership}
                </Badge>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Certifications</label>
            <div className="flex flex-wrap gap-2">
              {CERTIFICATION_OPTIONS.map((cert) => (
                <Badge
                  key={cert}
                  variant={certifications.includes(cert) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayValue(certifications, cert, setCertifications)}
                >
                  {cert}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex justify-end gap-3 px-6 pb-6 pt-4"
          style={{ borderTop: '1px solid var(--ridge-outer)' }}
        >
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
