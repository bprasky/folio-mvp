'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUser(userData);
        } else {
          router.push('/auth/signin');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        router.push('/auth/signin');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    if (!currentUser) {
      setMessage('User not found');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          type: 'VENDOR',
          description: formData.description,
          website: formData.website,
          userId: currentUser.id,
          userRole: 'OWNER',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Organization created successfully! Redirecting...');
        setTimeout(() => {
          router.push('/vendor/create-project');
        }, 2000);
      } else {
        setMessage(data.error || 'Failed to create organization');
      }
    } catch (error) {
      setMessage('Error creating organization. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="mt-4 folio-body text-[var(--text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="folio-h2 mb-4">Please Sign In</h1>
          <p className="folio-body text-[var(--text-secondary)] mb-4">You need to be signed in to create an organization.</p>
          <a href="/auth/signin" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-8">
      <div className="max-w-2xl mx-auto px-4">
        <RidgeCard padding="xl">
          <div className="mb-6">
            <h1 className="folio-h1 mb-2">Create Vendor Organization</h1>
            <p className="folio-body text-[var(--text-secondary)]">
              Set up your organization to start creating projects for designers.
            </p>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              message.includes('successfully')
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block folio-body font-medium text-[var(--text-primary)] mb-2">
                Organization Name *
              </label>
              <Input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter your organization name"
              />
            </div>

            <div>
              <label htmlFor="description" className="block folio-body font-medium text-[var(--text-primary)] mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="ridge-input w-full px-3 py-2"
                placeholder="Brief description of your organization"
              />
            </div>

            <div>
              <label htmlFor="website" className="block folio-body font-medium text-[var(--text-primary)] mb-2">
                Website
              </label>
              <Input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://your-website.com"
              />
            </div>

            <div className="flex space-x-4">
              <Button
                type="submit"
                variant="accent"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Creating...' : 'Create Organization'}
              </Button>
              <Button
                type="button"
                variant="ridge"
                onClick={() => router.push('/vendor/create-project')}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </RidgeCard>
      </div>
    </div>
  );
} 