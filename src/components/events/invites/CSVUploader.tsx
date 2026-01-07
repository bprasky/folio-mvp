"use client";

import { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface CSVUploaderProps {
  eventId: string;
  onSuccess?: (count: number) => void;
}

export default function CSVUploader({ eventId, onSuccess }: CSVUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source', 'csv');

      const response = await fetch(`/api/events/${eventId}/invites/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, count: data.created });
        onSuccess?.(data.created);
        setFile(null);
      } else {
        setResult({ success: false, error: data.error || 'Upload failed' });
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message || 'Upload failed' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-ink mb-2">Upload CSV File</h3>
        <p className="text-sm text-stone-500 mb-4">
          Upload a CSV file with columns: email, name, phone, company, title, role
        </p>
      </div>

      <div className="border-2 border-dashed border-stone-300 rounded-lg p-8 text-center">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="csv-upload"
        />
        <label
          htmlFor="csv-upload"
          className="cursor-pointer flex flex-col items-center space-y-2"
        >
          <Upload className="w-8 h-8 text-stone-400" />
          <span className="text-sm font-medium text-ink">
            {file ? file.name : 'Choose CSV file'}
          </span>
          <span className="text-xs text-stone-500">
            {file ? 'Click to change' : 'or drag and drop'}
          </span>
        </label>
      </div>

      {file && (
        <div className="flex items-center space-x-2 p-3 bg-stone-50 rounded-lg">
          <FileText className="w-4 h-4 text-stone-500" />
          <span className="text-sm text-ink flex-1">{file.name}</span>
          <button
            onClick={() => setFile(null)}
            className="text-xs text-stone-500 hover:text-ink"
          >
            Remove
          </button>
        </div>
      )}

      {result && (
        <div
          className={`p-4 rounded-lg flex items-start space-x-3 ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            {result.success ? (
              <p className="text-sm text-green-800">
                Successfully uploaded {result.count} contacts
              </p>
            ) : (
              <p className="text-sm text-red-800">{result.error}</p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="w-full px-4 py-2 bg-ink text-white rounded-lg font-medium hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isUploading ? 'Uploading...' : 'Upload CSV'}
      </button>
    </div>
  );
}




