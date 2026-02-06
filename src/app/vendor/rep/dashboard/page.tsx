'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface FeedItem {
  id: string;
  type: 'project_tagged';
  project: {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    updatedAt: Date;
  };
  designer: {
    id: string;
    name: string;
    email: string;
    profileImage: string | null;
  } | null;
  summary: string;
  productCount: number;
  createdAt: Date;
}

interface Designer {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
}

export default function RepDashboardPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [following, setFollowing] = useState<Designer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setError('Please sign in to view your rep dashboard');
      setLoading(false);
      return;
    }

    fetch('/api/vendor/rep/dashboard')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setFeedItems(data.feedItems || []);
          setFollowing(data.following || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load dashboard');
        setLoading(false);
      });
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-elevated)] px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block bg-[var(--accent)] text-white py-2 px-4 rounded hover:bg-[var(--accent-hover)]"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-elevated)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Left Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Following</h2>
              {following.length === 0 ? (
                <p className="text-sm text-gray-500">No designers yet</p>
              ) : (
                <div className="space-y-3">
                  {following.map((designer) => (
                    <Link
                      key={designer.id}
                      href={`/designer/${designer.id}`}
                      className="flex items-center gap-3 p-2 rounded hover:bg-[var(--bg-elevated)]"
                    >
                      {designer.profileImage ? (
                        <img
                          src={designer.profileImage}
                          alt={designer.name}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500 text-sm">
                            {designer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{designer.name}</p>
                        <p className="text-xs text-gray-500 truncate">{designer.email}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Main Feed */}
          <main className="flex-1">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h1 className="text-2xl font-bold mb-2">Rep Mode Dashboard</h1>
              <p className="text-gray-600 text-sm">
                This feed is automatically populated with designers and projects that have tagged your organization on Folio.
              </p>
            </div>

            {feedItems.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">No activity yet. Projects where your organization is tagged will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-4">
                      {item.project.imageUrl && (
                        <div className="flex-shrink-0">
                          <img
                            src={item.project.imageUrl}
                            alt={item.project.title}
                            className="w-24 h-24 object-cover rounded"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <Link
                              href={`/project/${item.project.id}`}
                              className="text-lg font-semibold hover:text-[var(--accent)]"
                            >
                              {item.project.title || 'Untitled Project'}
                            </Link>
                            {item.designer && (
                              <Link
                                href={`/designer/${item.designer.id}`}
                                className="text-sm text-gray-600 hover:text-[var(--accent)] ml-2"
                              >
                                by {item.designer.name}
                              </Link>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{item.summary}</p>
                        {item.productCount > 0 && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{item.productCount} product{item.productCount !== 1 ? 's' : ''} tagged</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}




