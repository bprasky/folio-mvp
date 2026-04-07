'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Suggestion } from '@/lib/suggestions/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-hot-toast';

interface ActionSheetProps {
  suggestion: Suggestion | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ActionSheet({ suggestion, isOpen, onClose }: ActionSheetProps) {
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!suggestion) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Show success toast with different messages based on action type
    let message = '';
    switch (suggestion.actionType) {
      case 'upload':
        message = 'Assets uploaded successfully! Team will review within 24 hours.';
        break;
      case 'promo':
        message = `Promotion scheduled! ${suggestion.payload?.discount || 5}% discount will go live as configured.`;
        break;
      case 'message':
        message = 'Messages sent successfully! Recipients will receive notifications.';
        break;
      case 'invite':
        message = 'Invitations sent! You\'ll be notified when responses are received.';
        break;
      case 'editorial':
        message = 'Content created! Editorial team will review and publish.';
        break;
      default:
        message = 'Action completed successfully!';
    }

    toast.success(message, {
      duration: 4000,
      style: {
        background: '#F7F4F1',
        color: '#2B2B2B',
        border: '1px solid #DAD2CA'
      }
    });

    setIsSubmitting(false);
    onClose();
  };

  const renderFormFields = () => {
    switch (suggestion.actionType) {
      case 'upload':
        return (
          <>
            <div>
              <Label htmlFor="assetType">Asset Type</Label>
              <Select value={formData.assetType || ''} onValueChange={(value) => setFormData({...formData, assetType: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="photos">Styled Photos</SelectItem>
                  <SelectItem value="renders">3D Renders</SelectItem>
                  <SelectItem value="specs">Technical Specs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fileCount">Number of Files (1-10)</Label>
              <Input
                id="fileCount"
                type="number"
                min="1"
                max="10"
                value={formData.fileCount || suggestion.payload?.count || 3}
                onChange={(e) => setFormData({...formData, fileCount: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any specific instructions or context..."
                value={formData.notes || ''}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </>
        );

      case 'promo':
        return (
          <>
            <div>
              <Label htmlFor="discount">Discount Percentage</Label>
              <Input
                id="discount"
                type="number"
                min="1"
                max="20"
                value={formData.discount || suggestion.payload?.discount || 5}
                onChange={(e) => setFormData({...formData, discount: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration (days)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="30"
                value={formData.duration || suggestion.payload?.duration || 7}
                onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="promoCode">Promo Code (Optional)</Label>
              <Input
                id="promoCode"
                placeholder="e.g., KITCHEN5"
                value={formData.promoCode || ''}
                onChange={(e) => setFormData({...formData, promoCode: e.target.value})}
              />
            </div>
          </>
        );

      case 'message':
        return (
          <>
            <div>
              <Label htmlFor="messageType">Message Type</Label>
              <Select value={formData.messageType || ''} onValueChange={(value) => setFormData({...formData, messageType: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select message type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specSheet">Spec Sheet Bundle</SelectItem>
                  <SelectItem value="followUp">Follow-up Outreach</SelectItem>
                  <SelectItem value="personal">Personalized Message</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="recipientCount">Number of Recipients</Label>
              <Input
                id="recipientCount"
                type="number"
                min="1"
                max="50"
                value={formData.recipientCount || suggestion.payload?.count || 3}
                onChange={(e) => setFormData({...formData, recipientCount: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="messageContent">Message Content</Label>
              <Textarea
                id="messageContent"
                placeholder="Write your message here..."
                value={formData.messageContent || ''}
                onChange={(e) => setFormData({...formData, messageContent: e.target.value})}
                rows={4}
              />
            </div>
          </>
        );

      case 'invite':
        return (
          <>
            <div>
              <Label htmlFor="inviteType">Invitation Type</Label>
              <Select value={formData.inviteType || ''} onValueChange={(value) => setFormData({...formData, inviteType: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select invitation type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collabBoard">Collaboration Board</SelectItem>
                  <SelectItem value="microEvent">Micro-Event</SelectItem>
                  <SelectItem value="exclusiveAccess">Exclusive Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="eventDate">Event Date (if applicable)</Label>
              <Input
                id="eventDate"
                type="date"
                value={formData.eventDate || ''}
                onChange={(e) => setFormData({...formData, eventDate: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="inviteMessage">Invitation Message</Label>
              <Textarea
                id="inviteMessage"
                placeholder="Personalize your invitation..."
                value={formData.inviteMessage || ''}
                onChange={(e) => setFormData({...formData, inviteMessage: e.target.value})}
                rows={3}
              />
            </div>
          </>
        );

      case 'editorial':
        return (
          <>
            <div>
              <Label htmlFor="contentType">Content Type</Label>
              <Select value={formData.contentType || ''} onValueChange={(value) => setFormData({...formData, contentType: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recap">Event Recap Post</SelectItem>
                  <SelectItem value="featured">Featured Product Set</SelectItem>
                  <SelectItem value="taglines">Product Taglines</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contentTitle">Content Title</Label>
              <Input
                id="contentTitle"
                placeholder="Enter content title..."
                value={formData.contentTitle || ''}
                onChange={(e) => setFormData({...formData, contentTitle: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="contentDescription">Description</Label>
              <Textarea
                id="contentDescription"
                placeholder="Describe what you'd like to create..."
                value={formData.contentDescription || ''}
                onChange={(e) => setFormData({...formData, contentDescription: e.target.value})}
                rows={4}
              />
            </div>
          </>
        );

      default:
        return (
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your request..."
              value={formData.description || ''}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>
        );
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="bg-surface-elevated border-folio-border-strong w-[500px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle className="text-folio-text-primary font-serif">
            {suggestion.title}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div className="p-4 bg-surface-canvas rounded-lg border border-folio-border-strong">
            <p className="text-sm text-folio-text-secondary">{suggestion.reason}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {renderFormFields()}
            
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[#8C8278] hover:bg-[#3A332E] text-white"
              >
                {isSubmitting ? 'Processing...' : suggestion.actionLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="border-folio-border-strong text-folio-text-secondary hover:bg-surface-canvas"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}









