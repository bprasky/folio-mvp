'use client';

import { useState } from 'react';
import { SCENE_PRESETS, DEFAULT_PRESET_ID, resolvePresetId } from '@/lib/three-d/scene-presets';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

interface ScenePresetPickerProps {
  productId: string;
  currentPresetId?: string | null;
  productCategory?: string | null;
  onPresetChange?: (presetId: string | null) => void;
}

const presetEntries = Object.values(SCENE_PRESETS);

/**
 * Simple radio-group picker for scene presets.
 * Shows preset name, subtitle, and a gradient swatch.
 * "Auto" option clears scenePresetId (null) → system picks by category.
 */
export function ScenePresetPicker({
  productId,
  currentPresetId,
  productCategory,
  onPresetChange,
}: ScenePresetPickerProps) {
  const [selected, setSelected] = useState<string | null>(
    currentPresetId ? resolvePresetId(currentPresetId) : null
  );
  const [saving, setSaving] = useState(false);

  const handleSelect = async (presetId: string | null) => {
    setSelected(presetId);
    setSaving(true);

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenePresetId: presetId }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(presetId ? `Scene set to ${SCENE_PRESETS[presetId]?.name}` : 'Scene set to auto');
      onPresetChange?.(presetId);
    } catch {
      toast.error('Failed to update scene preset');
      setSelected(currentPresetId || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[#2C2825] uppercase tracking-wider">
        Scene Environment
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {/* Auto option */}
        <button
          onClick={() => handleSelect(null)}
          disabled={saving}
          className={`relative flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
            selected === null
              ? 'border-[#c9a96e] bg-[#c9a96e]/5'
              : 'border-[#E5E0D7] hover:border-[#c9a96e]/30 bg-[#FAF8F5]'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-stone-200 to-stone-300 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-[#2C2825]">Auto</div>
            <div className="text-[10px] text-[#8C8278]">
              {productCategory ? `Based on "${productCategory}"` : 'Default'}
            </div>
          </div>
          {selected === null && (
            <Check className="w-4 h-4 text-[#c9a96e] absolute top-2 right-2" />
          )}
        </button>

        {/* Preset options */}
        {presetEntries.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handleSelect(preset.id)}
            disabled={saving}
            className={`relative flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
              selected === preset.id
                ? 'border-[#c9a96e] bg-[#c9a96e]/5'
                : 'border-[#E5E0D7] hover:border-[#c9a96e]/30 bg-[#FAF8F5]'
            }`}
          >
            {/* Gradient swatch */}
            <div
              className="w-8 h-8 rounded-lg shrink-0"
              style={{
                background: `linear-gradient(180deg, ${preset.bgGradient[0]}, ${preset.bgGradient[1]}, ${preset.bgGradient[2]})`,
              }}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#2C2825]">{preset.name}</div>
              <div className="text-[10px] text-[#8C8278] italic">{preset.subtitle}</div>
            </div>
            {selected === preset.id && (
              <Check className="w-4 h-4 text-[#c9a96e] absolute top-2 right-2" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
