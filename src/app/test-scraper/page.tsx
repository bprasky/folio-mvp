'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Globe, ArrowRight, Play } from 'lucide-react';
import Link from 'next/link';

export default function TestScraperPage() {
  const [website, setWebsite] = useState('');
  const [eventId, setEventId] = useState('nycxdesign-2025');

  const handleTestScraper = () => {
    if (website) {
      window.open(`/signup/designer/enhanced?event=${eventId}&test=true`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">Scraper Test</h1>
            </div>
            <p className="text-gray-600">
              Test the enhanced designer signup with website scraping functionality
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Website URL
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Enter a website to test the scraping functionality
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event ID (Optional)
              </label>
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="nycxdesign-2025"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleTestScraper}
                disabled={!website}
                className="flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                <span>Test Enhanced Signup</span>
              </button>

              <Link
                href="/signup/designer/enhanced"
                className="flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Direct Access</span>
              </Link>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Test URLs</h3>
              <div className="space-y-2">
                {[
                  'https://www.studiolife.com',
                  'https://www.interiordesignstudio.com',
                  'https://www.architecturalfirm.com',
                  'https://www.designcollective.com'
                ].map((url) => (
                  <button
                    key={url}
                    onClick={() => setWebsite(url)}
                    className="block w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-700"
                  >
                    {url}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">What to Test</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Website URL input and validation</li>
                <li>• Scraping progress indicators</li>
                <li>• Portfolio data preview</li>
                <li>• Form submission with scraped data</li>
                <li>• Event attribution (if event ID provided)</li>
              </ul>
            </div>

            <div className="text-center">
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 