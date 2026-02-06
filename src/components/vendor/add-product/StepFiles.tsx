'use client';

import { useState } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { ProductDraft } from '@/types/vendor-product';
import { FileText, Box, File, X, Upload } from 'lucide-react';

interface StepFilesProps {
  initialData: Partial<ProductDraft>;
  onNext: (data: Partial<ProductDraft>) => void;
  onBack: () => void;
}

export function StepFiles({ initialData, onNext, onBack }: StepFilesProps) {
  const [specSheets, setSpecSheets] = useState(initialData.files?.specSheets || []);
  const [files3d, setFiles3d] = useState(initialData.files?._3d || []);
  const [others, setOthers] = useState(initialData.files?.others || []);

  const addSpecSheet = () => {
    setSpecSheets(prev => [...prev, { label: '', url: '' }]);
  };

  const add3dFile = () => {
    setFiles3d(prev => [...prev, { label: '', url: '' }]);
  };

  const addOther = () => {
    setOthers(prev => [...prev, { label: '', url: '' }]);
  };

  const updateItem = (
    list: typeof specSheets,
    setter: React.Dispatch<React.SetStateAction<typeof specSheets>>,
    index: number,
    field: 'label' | 'url',
    value: string
  ) => {
    setter(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeItem = (
    setter: React.Dispatch<React.SetStateAction<typeof specSheets>>,
    index: number
  ) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    // Check if any spec sheets have invalid URLs (must be .pdf)
    for (const sheet of specSheets) {
      if (sheet.url && !sheet.url.toLowerCase().endsWith('.pdf')) {
        return { valid: false, error: 'Spec sheets must be PDF files (.pdf)' };
      }
    }

    return { valid: true };
  };

  const handleNext = () => {
    const validation = validate();
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const filesData: Partial<ProductDraft> = {
      files: {
        specSheets: specSheets.filter(s => s.url),
        _3d: files3d.filter(f => f.url),
        others: others.filter(o => o.url),
      },
    };

    onNext(filesData);
  };

  return (
    <GlassPanel>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900">
            <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-2xl font-medium text-stone-900 dark:text-stone-100">
              Add Files
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Upload spec sheets, 3D models, and other resources (optional)
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Spec Sheets */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-stone-600 dark:text-stone-400" />
                <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">
                  Spec Sheets (PDF)
                </h3>
              </div>
              <button
                onClick={addSpecSheet}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-sm"
              >
                <Upload className="w-4 h-4" />
                Add Spec Sheet
              </button>
            </div>

            {specSheets.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
                <FileText className="w-10 h-10 mx-auto mb-2 text-stone-400" />
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  No spec sheets added
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {specSheets.map((sheet, index) => (
                  <FileItem
                    key={index}
                    item={sheet}
                    index={index}
                    onUpdate={(field, value) => updateItem(specSheets, setSpecSheets, index, field, value)}
                    onRemove={() => removeItem(setSpecSheets, index)}
                    placeholder="Spec Sheet"
                    urlPlaceholder="https://example.com/specs/product-spec.pdf"
                    fileExtension=".pdf"
                  />
                ))}
              </div>
            )}
          </div>

          {/* 3D Files */}
          <div className="space-y-4 pt-6 border-t border-stone-200 dark:border-stone-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-stone-600 dark:text-stone-400" />
                <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">
                  3D Models
                </h3>
              </div>
              <button
                onClick={add3dFile}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-sm"
              >
                <Upload className="w-4 h-4" />
                Add 3D File
              </button>
            </div>

            <p className="text-sm text-stone-600 dark:text-stone-400">
              Supported formats: .glb, .gltf, .obj, .fbx, .step, .stp
            </p>

            {files3d.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
                <Box className="w-10 h-10 mx-auto mb-2 text-stone-400" />
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  No 3D models added
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {files3d.map((file, index) => (
                  <FileItem
                    key={index}
                    item={file}
                    index={index}
                    onUpdate={(field, value) => updateItem(files3d, setFiles3d, index, field, value)}
                    onRemove={() => removeItem(setFiles3d, index)}
                    placeholder="3D Model"
                    urlPlaceholder="https://example.com/models/product.glb"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Other Files */}
          <div className="space-y-4 pt-6 border-t border-stone-200 dark:border-stone-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <File className="w-5 h-5 text-stone-600 dark:text-stone-400" />
                <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">
                  Additional Resources
                </h3>
              </div>
              <button
                onClick={addOther}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-sm"
              >
                <Upload className="w-4 h-4" />
                Add File
              </button>
            </div>

            {others.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
                <File className="w-10 h-10 mx-auto mb-2 text-stone-400" />
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  No additional files added
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {others.map((file, index) => (
                  <FileItem
                    key={index}
                    item={file}
                    index={index}
                    onUpdate={(field, value) => updateItem(others, setOthers, index, field, value)}
                    onRemove={() => removeItem(setOthers, index)}
                    placeholder="Care Guide, Installation Instructions, etc."
                    urlPlaceholder="https://example.com/docs/care-guide.pdf"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-stone-200 dark:border-stone-700">
          <button
            onClick={onBack}
            className="text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
          >
            ← Back
          </button>
          
          <Button onClick={handleNext}>
            Next: Review & Publish
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
}

function FileItem({
  item,
  index,
  onUpdate,
  onRemove,
  placeholder,
  urlPlaceholder,
  fileExtension,
}: {
  item: { label: string; url: string };
  index: number;
  onUpdate: (field: 'label' | 'url', value: string) => void;
  onRemove: () => void;
  placeholder: string;
  urlPlaceholder: string;
  fileExtension?: string;
}) {
  return (
    <div className="p-4 border border-stone-200 dark:border-stone-700 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
          File {index + 1}
        </span>
        <button
          onClick={onRemove}
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
        </button>
      </div>

      <input
        type="text"
        value={item.label}
        onChange={(e) => onUpdate('label', e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-sm"
      />

      <input
        type="url"
        value={item.url}
        onChange={(e) => onUpdate('url', e.target.value)}
        placeholder={urlPlaceholder}
        className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-sm"
      />

      {fileExtension && (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Required format: {fileExtension}
        </p>
      )}
    </div>
  );
}




