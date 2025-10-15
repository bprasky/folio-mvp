'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  TrendingUp, 
  Calendar, 
  Headphones, 
  CheckCircle,
  Star,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';

interface QuickActionsMenuProps {
  projectId: string;
  productId?: string;
  vendorId: string;
}

export default function VendorQuickActionsMenu({ projectId, productId, vendorId }: QuickActionsMenuProps) {
  const [actionType, setActionType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionData, setActionData] = useState<Record<string, any>>({});

  const handleAction = async (type: string, data: Record<string, any> = {}) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/vendor/actions/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          productId,
          ...data,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${type.replace('-', ' ')}`);
      }

      const result = await response.json();
      toast.success(result.message || 'Action completed successfully!');
      setActionType(null);
      setActionData({});
    } catch (error) {
      console.error(`Error with ${type}:`, error);
      toast.error(`Failed to ${type.replace('-', ' ')}`);
    } finally {
      setIsLoading(false);
    }
  };

  const actions = [
    {
      id: 'promote-project',
      label: 'Promote Project',
      description: 'Flag for editorial boost',
      icon: TrendingUp,
      endpoint: 'promote-project',
    },
    {
      id: 'invite-event',
      label: 'Invite to Event',
      description: 'Send event invitation',
      icon: Calendar,
      endpoint: 'invite-event',
    },
    {
      id: 'priority-support',
      label: 'Priority Support',
      description: 'Request urgent assistance',
      icon: Headphones,
      endpoint: 'priority-support',
    },
    {
      id: 'confirm-spec',
      label: 'Confirm Spec Change',
      description: 'Confirm product specification',
      icon: CheckCircle,
      endpoint: 'confirm-spec',
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            onClick={() => setActionType(action.id)}
            className="flex items-center gap-2"
          >
            <action.icon className="h-4 w-4" />
            <div>
              <div className="font-medium">{action.label}</div>
              <div className="text-xs text-gray-500">{action.description}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>

      {/* Action Dialogs */}
      {actionType === 'invite-event' && (
        <Dialog open={true} onOpenChange={() => setActionType(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite to Event</DialogTitle>
              <DialogDescription>
                Send an invitation to a designer for an upcoming event.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="eventId">Event ID *</Label>
                <Input
                  id="eventId"
                  placeholder="Event ID"
                  value={actionData.eventId || ''}
                  onChange={(e) => setActionData({ ...actionData, eventId: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="designerId">Designer ID (Optional)</Label>
                <Input
                  id="designerId"
                  placeholder="Designer ID"
                  value={actionData.designerId || ''}
                  onChange={(e) => setActionData({ ...actionData, designerId: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Optional message..."
                  value={actionData.message || ''}
                  onChange={(e) => setActionData({ ...actionData, message: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActionType(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleAction('invite-event', actionData)}
                  disabled={isLoading || !actionData.eventId}
                >
                  {isLoading ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {actionType === 'priority-support' && (
        <Dialog open={true} onOpenChange={() => setActionType(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Priority Support</DialogTitle>
              <DialogDescription>
                Mark this project or product for priority support assistance.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="note">Support Request Details</Label>
                <Textarea
                  id="note"
                  placeholder="Describe the issue or support needed..."
                  value={actionData.note || ''}
                  onChange={(e) => setActionData({ ...actionData, note: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActionType(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleAction('priority-support', actionData)}
                  disabled={isLoading}
                >
                  {isLoading ? 'Requesting...' : 'Request Support'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {actionType === 'confirm-spec' && (
        <Dialog open={true} onOpenChange={() => setActionType(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Spec Change</DialogTitle>
              <DialogDescription>
                Confirm a product specification change for this project.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="changeType">Change Type *</Label>
                <Select
                  value={actionData.changeType || ''}
                  onValueChange={(value) => setActionData({ ...actionData, changeType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select change type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                    <SelectItem value="alt_suggested">Alternative Suggested</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="message">Details</Label>
                <Textarea
                  id="message"
                  placeholder="Additional details about the change..."
                  value={actionData.message || ''}
                  onChange={(e) => setActionData({ ...actionData, message: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="altProductId">Alternative Product ID (Optional)</Label>
                <Input
                  id="altProductId"
                  placeholder="Alternative product ID"
                  value={actionData.altProductId || ''}
                  onChange={(e) => setActionData({ ...actionData, altProductId: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActionType(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleAction('confirm-spec', actionData)}
                  disabled={isLoading || !actionData.changeType}
                >
                  {isLoading ? 'Confirming...' : 'Confirm Change'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Simple actions */}
      {actionType === 'promote-project' && (
        <Dialog open={true} onOpenChange={() => setActionType(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Promote Project</DialogTitle>
              <DialogDescription>
                Flag this project for editorial boost and increased visibility.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActionType(null)}>
                Cancel
              </Button>
              <Button 
                onClick={() => handleAction('promote-project')}
                disabled={isLoading}
              >
                {isLoading ? 'Promoting...' : 'Promote Project'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DropdownMenu>
  );
}

