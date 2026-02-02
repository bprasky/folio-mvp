'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { FaImage, FaSpinner, FaThumbsUp, FaThumbsDown, FaLightbulb, FaExclamationTriangle } from 'react-icons/fa';
import { calculateReadinessScore, SelectionForScoring } from '@/lib/boards/readinessScore';

// Selection type for scoring
type SelectionData = {
  id: string;
  photo?: string | null;
  vendorName?: string | null;
  productName?: string | null;
  colorFinish?: string | null;
  tags?: string[];
  unitPrice?: number | null;
  productUrl?: string | null;
};

interface GeneratedAsset {
  id: string;
  url: string;
  width: number;
  height: number;
}

interface GenerateDialogProps {
  projectId: string;
  roomId: string;
  roomName: string;
  selections: SelectionData[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (assets: GeneratedAsset[]) => void;
}

type FeedbackReason = 'wrong_style' | 'missing_elements' | 'wrong_colors' | 'other';

interface FeedbackState {
  rating: 'positive' | 'negative' | null;
  reasons: FeedbackReason[];
  customFeedback: string;
}

export default function GenerateDialog({
  projectId,
  roomId,
  roomName,
  selections,
  open,
  onOpenChange,
  onDone
}: GenerateDialogProps) {
  const [modifiers, setModifiers] = useState('');
  const [count, setCount] = useState(2);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [seed, setSeed] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Generation result state
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    rating: null,
    reasons: [],
    customFeedback: ''
  });
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Calculate readiness score
  const readiness = useMemo(() => {
    return calculateReadinessScore(selections as SelectionForScoring[]);
  }, [selections]);

  const handleGenerate = async (withFeedback?: string) => {
    const isRegen = !!withFeedback;
    if (isRegen) {
      setIsRegenerating(true);
    } else {
      setIsGenerating(true);
    }
    setGenerationProgress(0);

    try {
      // Build modifiers with feedback if regenerating
      let finalModifiers = modifiers.trim();
      if (withFeedback) {
        finalModifiers = finalModifiers
          ? `${finalModifiers}. User feedback: ${withFeedback}`
          : `User feedback: ${withFeedback}`;
      }

      const response = await fetch(`/api/projects/${projectId}/rooms/${roomId}/gen-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modifiers: finalModifiers,
          n: count,
          width,
          height,
          seed: seed.trim() || undefined,
          // Include readiness score for analytics
          readinessScore: readiness.score,
          isRegeneration: isRegen,
        })
      });

      if (!response.ok) {
        const msg = await response.json().catch(() => ({}));
        const hint = msg?.error || (response.status === 502 ? "The image service returned no images." : "Generation failed.");
        throw new Error(hint);
      }

      const result = await response.json();

      // Simulate progress for better UX
      for (let i = 0; i < 100; i += 10) {
        setGenerationProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      setGenerationProgress(100);

      toast.success(`${result.assets.length} images generated successfully`);

      // Store generated assets and show feedback UI
      setGeneratedAssets(result.assets);
      setShowFeedback(true);
      setFeedback({ rating: null, reasons: [], customFeedback: '' });

    } catch (error: any) {
      console.error('Generation error:', error);

      if (error.message?.includes('502')) {
        toast.error('The image service returned no results—try again or adjust modifiers.');
      } else if (error.message?.includes('401')) {
        toast.error('Unauthorized — please sign in again.');
      } else if (error.message?.includes('403')) {
        toast.error('Forbidden — you don\'t have access to this project.');
      } else if (error.message?.includes('429')) {
        toast.error('Rate limit exceeded — please try again later.');
      } else {
        toast.error(error.message || 'Failed to generate images');
      }
    } finally {
      setIsGenerating(false);
      setIsRegenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleFeedbackRating = async (rating: 'positive' | 'negative') => {
    setFeedback(prev => ({ ...prev, rating }));

    // Log feedback for analytics (fire and forget)
    try {
      await fetch(`/api/projects/${projectId}/rooms/${roomId}/gen-image/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          readinessScore: readiness.score,
          assetIds: generatedAssets.map(a => a.id),
        })
      });
    } catch (e) {
      // Silent fail for analytics
    }

    if (rating === 'positive') {
      // Complete and close
      if (onDone) {
        onDone(generatedAssets);
      }
      handleClose();
    }
    // If negative, show refinement options
  };

  const handleRegenerate = () => {
    // Build feedback string from reasons and custom text
    const feedbackParts: string[] = [];

    if (feedback.reasons.includes('wrong_style')) {
      feedbackParts.push('The style was not what I expected');
    }
    if (feedback.reasons.includes('missing_elements')) {
      feedbackParts.push('Key elements from my selections are missing');
    }
    if (feedback.reasons.includes('wrong_colors')) {
      feedbackParts.push('The colors do not match my selections');
    }
    if (feedback.customFeedback.trim()) {
      feedbackParts.push(feedback.customFeedback.trim());
    }

    const feedbackString = feedbackParts.join('. ');
    handleGenerate(feedbackString);
  };

  const handleClose = () => {
    setShowFeedback(false);
    setGeneratedAssets([]);
    setFeedback({ rating: null, reasons: [], customFeedback: '' });
    onOpenChange(false);
  };

  const handleAcceptAnyway = () => {
    if (onDone) {
      onDone(generatedAssets);
    }
    handleClose();
  };

  const toggleReason = (reason: FeedbackReason) => {
    setFeedback(prev => ({
      ...prev,
      reasons: prev.reasons.includes(reason)
        ? prev.reasons.filter(r => r !== reason)
        : [...prev.reasons, reason]
    }));
  };

  const sizePresets = [
    { label: 'Square (1024×1024)', width: 1024, height: 1024 },
    { label: 'Portrait (1024×1792)', width: 1024, height: 1792 },
    { label: 'Landscape (1792×1024)', width: 1792, height: 1024 }
  ];

  const handleSizePreset = (preset: typeof sizePresets[0]) => {
    setWidth(preset.width);
    setHeight(preset.height);
  };

  // Readiness indicator color
  const getReadinessColor = () => {
    if (readiness.score >= 75) return 'bg-green-500';
    if (readiness.score >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getReadinessTextColor = () => {
    if (readiness.score >= 75) return 'text-green-700';
    if (readiness.score >= 50) return 'text-yellow-700';
    return 'text-orange-700';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FaImage className="w-5 h-5" />
            Generate AI Images
          </DialogTitle>
        </DialogHeader>

        {/* Feedback View (shown after generation) */}
        {showFeedback ? (
          <div className="space-y-6">
            {/* Generated Images Preview */}
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Generated Images
              </Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {generatedAssets.map((asset) => (
                  <div key={asset.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={asset.url}
                      alt="Generated"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback Prompt */}
            {feedback.rating === null && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  How did we do?
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleFeedbackRating('positive')}
                    className="flex-1 gap-2"
                  >
                    <FaThumbsUp className="w-4 h-4 text-green-600" />
                    Looks great!
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleFeedbackRating('negative')}
                    className="flex-1 gap-2"
                  >
                    <FaThumbsDown className="w-4 h-4 text-orange-600" />
                    Needs work
                  </Button>
                </div>
              </div>
            )}

            {/* Refinement Options (shown after negative feedback) */}
            {feedback.rating === 'negative' && (
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-sm font-medium text-orange-800 mb-3">
                    What could be improved?
                  </p>
                  <div className="space-y-2">
                    {[
                      { key: 'wrong_style' as FeedbackReason, label: 'Wrong style / aesthetic' },
                      { key: 'missing_elements' as FeedbackReason, label: 'Missing key elements from my selections' },
                      { key: 'wrong_colors' as FeedbackReason, label: 'Colors don\'t match' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={feedback.reasons.includes(key)}
                          onChange={() => toggleReason(key)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Tell us more about what you'd like to see..."
                    value={feedback.customFeedback}
                    onChange={(e) => setFeedback(prev => ({ ...prev, customFeedback: e.target.value }))}
                    className="mt-3"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleAcceptAnyway}
                    className="flex-1"
                  >
                    Use these anyway
                  </Button>
                  <Button
                    onClick={handleRegenerate}
                    disabled={isRegenerating || (feedback.reasons.length === 0 && !feedback.customFeedback.trim())}
                    className="flex-1"
                  >
                    {isRegenerating ? (
                      <>
                        <FaSpinner className="w-4 h-4 animate-spin mr-2" />
                        Regenerating...
                      </>
                    ) : (
                      'Regenerate with feedback'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Main Generation Form */
          <div className="space-y-6">
            {/* Readiness Score */}
            <div className="p-4 rounded-lg border bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">
                  Generation Readiness
                </Label>
                <span className={`text-sm font-semibold ${getReadinessTextColor()}`}>
                  {readiness.score}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getReadinessColor()}`}
                  style={{ width: `${readiness.score}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">{readiness.message}</p>

              {/* Suggestions */}
              {readiness.suggestions.length > 0 && readiness.score < 75 && (
                <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-200">
                  <div className="flex items-start gap-2">
                    <FaLightbulb className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-800">
                      <span className="font-medium">Tips to improve results:</span>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside">
                        {readiness.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Low readiness warning */}
              {readiness.score < 50 && (
                <div className="mt-3 p-2 bg-orange-50 rounded border border-orange-200">
                  <div className="flex items-start gap-2">
                    <FaExclamationTriangle className="w-3 h-3 text-orange-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-orange-800">
                      <span className="font-medium">{readiness.score}% completion</span> may result in less accurate images.
                      Consider adding more items or details before generating.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Selections Preview */}
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Based on your room selections ({selections.length} items)
              </Label>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 space-y-1">
                  {selections.slice(0, 6).map((selection, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {selection.photo ? (
                        <div className="w-6 h-6 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                          <img src={selection.photo} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded bg-gray-200 flex-shrink-0" />
                      )}
                      <span className="font-medium truncate">{selection.productName || 'Untitled Product'}</span>
                      {selection.vendorName && (
                        <span className="text-gray-400 text-xs">by {selection.vendorName}</span>
                      )}
                    </div>
                  ))}
                  {selections.length > 6 && (
                    <div className="text-gray-500">+{selections.length - 6} more items</div>
                  )}
                </div>
              </div>
            </div>

            {/* Modifiers */}
            <div>
              <Label htmlFor="modifiers" className="text-sm font-medium text-gray-700">
                Style & Mood Modifiers
              </Label>
              <Textarea
                id="modifiers"
                placeholder="e.g., warm neutral palette, soft afternoon light, human eye-level camera, editorial crop"
                value={modifiers}
                onChange={(e) => setModifiers(e.target.value)}
                className="mt-1"
                rows={3}
              />
              <p className="mt-1 text-xs text-gray-500">
                Suggested: "warm neutral palette, soft afternoon light, human eye-level camera, editorial crop" for consistent results
              </p>
            </div>

            {/* Generation Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="count" className="text-sm font-medium text-gray-700">
                  Number of Images
                </Label>
                <Select value={count.toString()} onValueChange={(value) => setCount(parseInt(value))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 image</SelectItem>
                    <SelectItem value="2">2 images</SelectItem>
                    <SelectItem value="3">3 images</SelectItem>
                    <SelectItem value="4">4 images</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="seed" className="text-sm font-medium text-gray-700">
                  Seed (optional)
                </Label>
                <Input
                  id="seed"
                  type="number"
                  placeholder="Random seed"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Size Presets */}
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Image Size
              </Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {sizePresets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant={width === preset.width && height === preset.height ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSizePreset(preset)}
                    className="text-xs"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="width" className="text-xs text-gray-600">Width</Label>
                  <Input
                    id="width"
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value) || 1024)}
                    min={256}
                    max={2048}
                    step={64}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="height" className="text-xs text-gray-600">Height</Label>
                  <Input
                    id="height"
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value) || 1024)}
                    min={256}
                    max={2048}
                    step={64}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            {isGenerating && (
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  Generating images...
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="min-w-32"
              >
                {isGenerating ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FaImage className="w-4 h-4 mr-2" />
                    Generate Images
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
