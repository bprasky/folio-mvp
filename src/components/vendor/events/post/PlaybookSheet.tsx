'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Users, Calendar, Percent } from "lucide-react";
import type { IntentDesigner, PlayItem } from "@/lib/mock/eventPost";
import { toast } from "react-hot-toast";
import { formatCurrency } from "@/lib/format";

interface PlaybookSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
  playItem?: PlayItem | null;
  type?: 'close' | 'sample' | 'moodboard' | 'localized' | 'reviews';
  designers?: IntentDesigner[];
}

export function PlaybookSheet({ isOpen, onClose, onSubmit, playItem, type, designers = [] }: PlaybookSheetProps) {
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentType = playItem?.actionType || type;

  const playbookConfig = {
    promo: {
      title: playItem?.title || 'Close Offer',
      description: 'Create closing incentive for high-intent designers',
      fields: [
        { key: 'discountPct', label: 'Discount %', type: 'number', defaultValue: 5 },
        { key: 'duration', label: 'Valid for (days)', type: 'number', defaultValue: 7 },
        { key: 'promoCode', label: 'Promo Code', type: 'text', defaultValue: '' },
        { key: 'message', label: 'Personal Message', type: 'textarea', defaultValue: '' }
      ]
    },
    sampleKit: {
      title: playItem?.title || 'Send Sample Kit',
      description: 'Provide sample materials to warm evaluators',
      fields: [
        { key: 'kitType', label: 'Kit Type', type: 'select', options: ['Full Range', 'Focus Collection', 'Custom Selection'] },
        { key: 'shipping', label: 'Shipping Priority', type: 'select', options: ['Standard', 'Express', 'Overnight'] },
        { key: 'message', label: 'Included Note', type: 'textarea', defaultValue: '' }
      ]
    },
    specPack: {
      title: playItem?.title || 'Send Spec Pack',
      description: 'Send detailed specifications to evaluators',
      fields: [
        { key: 'packType', label: 'Spec Pack Type', type: 'select', options: ['Technical Sheets', 'CAD Files', 'Full Documentation'] },
        { key: 'format', label: 'Format', type: 'select', options: ['PDF', 'Digital Library', 'Physical Mail'] },
        { key: 'message', label: 'Cover Note', type: 'textarea', defaultValue: '' }
      ]
    },
    localizeAssets: {
      title: playItem?.title || 'Localize Assets',
      description: 'Create region-specific marketing materials',
      fields: [
        { key: 'region', label: 'Target Region', type: 'select', options: ['North America', 'Europe', 'Asia Pacific', 'Custom'] },
        { key: 'assetType', label: 'Asset Type', type: 'select', options: ['Brochures', 'Digital Gallery', 'Case Studies'] },
        { key: 'message', label: 'Localization Notes', type: 'textarea', defaultValue: '' }
      ]
    },
    inviteLookalikes: {
      title: playItem?.title || 'Invite Look-alikes',
      description: 'Invite similar designers based on profile matching',
      fields: [
        { key: 'criteria', label: 'Matching Criteria', type: 'select', options: ['Firm Size', 'Design Style', 'Project Type', 'Location'] },
        { key: 'count', label: 'Number of Invites', type: 'number', defaultValue: 20 },
        { key: 'message', label: 'Invitation Message', type: 'textarea', defaultValue: '' }
      ]
    },
    scheduleReview: {
      title: playItem?.title || 'Schedule Reviews',
      description: 'Schedule account reviews with key firms',
      fields: [
        { key: 'reviewType', label: 'Review Type', type: 'select', options: ['Quarterly Check-in', 'Project Review', 'Portfolio Update'] },
        { key: 'duration', label: 'Meeting Duration (minutes)', type: 'number', defaultValue: 60 },
        { key: 'message', label: 'Agenda Notes', type: 'textarea', defaultValue: '' }
      ]
    }
  };

  const config = currentType ? playbookConfig[currentType] : null;
  const targetCount = playItem?.target.count || designers.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Show success toast
    let message = '';
    switch (currentType) {
      case 'promo':
        message = `Close offer sent to ${targetCount} targets!`;
        break;
      case 'sampleKit':
        message = `Sample kit request queued for ${targetCount} evaluators!`;
        break;
      case 'specPack':
        message = `Spec pack sent to ${targetCount} prospects!`;
        break;
      case 'localizeAssets':
        message = `Asset localization queued for ${targetCount} markets!`;
        break;
      case 'inviteLookalikes':
        message = `Invites sent to ${targetCount} look-alike designers!`;
        break;
      case 'scheduleReview':
        message = `Reviews scheduled for ${targetCount} firms!`;
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
    onSubmit?.(formData);
    onClose();
  };

  const renderField = (field: any) => {
    const value = formData[field.key] ?? field.defaultValue ?? '';

    switch (field.type) {
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
            className="border-folio-border-strong"
          />
        );
      case 'select':
        return (
          <Select value={value} onValueChange={(val) => setFormData({...formData, [field.key]: val})}>
            <SelectTrigger className="border-folio-border-strong">
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option: string) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
            className="border-folio-border-strong"
            rows={3}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        );
      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
            className="border-folio-border-strong"
          />
        );
    }
  };

  if (!config) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md bg-white p-6 flex flex-col">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl font-serif text-folio-text-primary">
                {config.title}
              </SheetTitle>
              <p className="text-sm text-folio-text-secondary mt-1">
                {config.description}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Target Summary */}
        <div className="bg-surface-elevated rounded-lg p-4 my-4">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="w-4 h-4 text-folio-text-secondary" />
            <span className="text-sm font-medium text-folio-text-primary">Target Audience</span>
          </div>
          <p className="text-sm text-folio-text-secondary">
            {targetCount} designer{targetCount !== 1 ? 's' : ''} selected
          </p>
          
          <div className="flex flex-wrap gap-1 mt-2">
            {designers.slice(0, 3).map((designer) => (
              <Badge key={designer.id} className="text-xs bg-[#8C8278]/10 text-folio-text-secondary border-[#8C8278]/20">
                {designer.name}
              </Badge>
            ))}
            {designers.length > 3 && (
              <Badge className="text-xs bg-[#8C8278]/10 text-folio-text-secondary border-[#8C8278]/20">
                +{designers.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-grow space-y-4">
          {config.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key} className="text-sm font-medium text-folio-text-primary">
                {field.label}
                {field.key === 'discountPct' && <Percent className="w-3 h-3 inline ml-1" />}
              </Label>
              {renderField(field)}
            </div>
          ))}

          <div className="mt-auto pt-4 border-t border-folio-border-strong">
            <Button 
              type="submit" 
              className="w-full bg-[#2B2B2B] hover:bg-[#8C8278] text-white" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : `Send to ${targetCount} Designer${targetCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
