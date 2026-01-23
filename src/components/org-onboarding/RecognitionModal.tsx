'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface RecognitionModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onSuccess: () => void;
}

type RecognitionType = 'PRESS' | 'AWARD' | 'SPEAKING' | 'CERTIFICATION';

const RECOGNITION_TYPES: { value: RecognitionType; label: string }[] = [
  { value: 'PRESS', label: 'Press Feature' },
  { value: 'AWARD', label: 'Award' },
  { value: 'SPEAKING', label: 'Speaking Engagement' },
  { value: 'CERTIFICATION', label: 'Certification' }
];

export function RecognitionModal({
  open,
  onClose,
  orgId,
  onSuccess
}: RecognitionModalProps) {
  const [type, setType] = useState<RecognitionType>('PRESS');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setType('PRESS');
    setTitle('');
    setSource('');
    setDate('');
    setUrl('');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !source.trim()) {
      setError('Title and source are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/orgs/${orgId}/recognition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          source: source.trim(),
          date: date || null,
          url: url.trim() || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add recognition');
      }

      onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      console.error('Recognition error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlaceholders = () => {
    switch (type) {
      case 'PRESS':
        return {
          title: 'e.g., Featured in "Best Homes of 2024"',
          source: 'e.g., Architectural Digest'
        };
      case 'AWARD':
        return {
          title: 'e.g., Best Residential Design',
          source: 'e.g., ASID Design Excellence Awards'
        };
      case 'SPEAKING':
        return {
          title: 'e.g., Sustainable Design in Modern Homes',
          source: 'e.g., Design Miami'
        };
      case 'CERTIFICATION':
        return {
          title: 'e.g., LEED Accredited Professional',
          source: 'e.g., U.S. Green Building Council'
        };
    }
  };

  const placeholders = getPlaceholders();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Georgia, serif' }}>Add Recognition</DialogTitle>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Highlight your studio's achievements, press features, and credentials.
          </p>
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

          {/* Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <div className="flex flex-wrap gap-2">
              {RECOGNITION_TYPES.map((item) => (
                <Badge
                  key={item.value}
                  variant={type === item.value ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setType(item.value)}
                >
                  {item.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {type === 'PRESS'
                ? 'Article/Feature Title'
                : type === 'AWARD'
                  ? 'Award Name'
                  : type === 'SPEAKING'
                    ? 'Talk/Panel Title'
                    : 'Certification Name'}
            </label>
            <Input
              placeholder={placeholders.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Source */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {type === 'PRESS'
                ? 'Publication'
                : type === 'AWARD'
                  ? 'Awarding Organization'
                  : type === 'SPEAKING'
                    ? 'Event/Conference'
                    : 'Issuing Organization'}
            </label>
            <Input
              placeholder={placeholders.source}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Link (optional)</label>
            <Input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
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
            Add Recognition
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
