'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { FaImage, FaSpinner } from 'react-icons/fa';

interface GenerateDialogProps {
  projectId: string;
  roomId: string;
  roomName: string;
  selectionsCount: number;
  selectionsPreview: Array<{ name: string; category?: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (assets: Array<{ id: string; url: string; width: number; height: number }>) => void;
}

export default function GenerateDialog({
  projectId,
  roomId,
  roomName,
  selectionsCount,
  selectionsPreview,
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      const response = await fetch(`/api/projects/${projectId}/rooms/${roomId}/gen-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modifiers: modifiers.trim(),
          n: count,
          width,
          height,
          seed: seed.trim() || undefined
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
      
      if (onDone) {
        onDone(result.assets);
      }
      
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('Generation error:', error);
      
      // Provide more specific error messages
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
      setGenerationProgress(0);
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FaImage className="w-5 h-5" />
            Generate AI Images
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selections Preview */}
          <div>
            <Label className="text-sm font-medium text-gray-700">
              Based on your room selections ({selectionsCount} items)
            </Label>
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 space-y-1">
                {selectionsPreview.slice(0, 6).map((selection, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-medium">{selection.name}</span>
                    {selection.category && (
                      <span className="text-gray-500">({selection.category})</span>
                    )}
                  </div>
                ))}
                {selectionsCount > 6 && (
                  <div className="text-gray-500">+{selectionsCount - 6} more items</div>
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
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
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
      </DialogContent>
    </Dialog>
  );
}
