'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Copy, ExternalLink, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface VisitCreatorProps {
  vendorId: string;
}

export default function VendorVisitCreator({ vendorId }: VisitCreatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [visitData, setVisitData] = useState<{
    projectId?: string;
    designerId?: string;
    note?: string;
    expiresAt?: string;
  }>({});
  const [createdVisit, setCreatedVisit] = useState<{
    id: string;
    token: string;
    url: string;
    expiresAt?: string;
  } | null>(null);

  const handleCreateVisit = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/vendor/visits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visitData),
      });

      if (!response.ok) {
        throw new Error('Failed to create visit');
      }

      const { visit } = await response.json();
      setCreatedVisit({
        id: visit.id,
        token: visit.token,
        url: `/visit/${visit.token}`,
        expiresAt: visit.expiresAt,
      });
      toast.success('Visit created successfully!');
    } catch (error) {
      console.error('Error creating visit:', error);
      toast.error('Failed to create visit');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = () => {
    if (createdVisit) {
      navigator.clipboard.writeText(`${window.location.origin}${createdVisit.url}`);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleReset = () => {
    setVisitData({});
    setCreatedVisit(null);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Start a Visit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Vendor Visit</DialogTitle>
          <DialogDescription>
            Create a shareable link for designers to view your products and specifications.
          </DialogDescription>
        </DialogHeader>
        
        {!createdVisit ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="projectId">Project ID (Optional)</Label>
                <Input
                  id="projectId"
                  placeholder="Project ID"
                  value={visitData.projectId || ''}
                  onChange={(e) => setVisitData({ ...visitData, projectId: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="designerId">Designer ID (Optional)</Label>
                <Input
                  id="designerId"
                  placeholder="Designer ID"
                  value={visitData.designerId || ''}
                  onChange={(e) => setVisitData({ ...visitData, designerId: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="expiresAt">Expires At (Optional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={visitData.expiresAt || ''}
                onChange={(e) => setVisitData({ ...visitData, expiresAt: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="note">Message/Agenda</Label>
              <Textarea
                id="note"
                placeholder="Optional message or agenda for the visit..."
                value={visitData.note || ''}
                onChange={(e) => setVisitData({ ...visitData, note: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateVisit} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Visit'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Visit Created Successfully!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Visit URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}${createdVisit.url}`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="sm" onClick={handleCopyLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {createdVisit.expiresAt && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    Expires: {new Date(createdVisit.expiresAt).toLocaleString()}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(createdVisit.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Preview Visit
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Create Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
