'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CreateFestivalPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    city: '',
    state: '',
    country: '',
    startDate: '',
    endDate: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('title', formData.title);
      uploadFormData.append('description', formData.description);
      uploadFormData.append('location', formData.location);
      uploadFormData.append('city', formData.city);
      uploadFormData.append('state', formData.state);
      uploadFormData.append('country', formData.country);

      if (formData.startDate) {
        const startDate = new Date(formData.startDate);
        startDate.setHours(0, 0, 0, 0);
        uploadFormData.append('startDate', startDate.toISOString());
      }
      if (formData.endDate) {
        const endDate = new Date(formData.endDate);
        endDate.setHours(23, 59, 59, 999);
        uploadFormData.append('endDate', endDate.toISOString());
      }

      if (session?.user?.id) {
        uploadFormData.append('createdById', session.user.id);
      }
      if (imageFile) {
        uploadFormData.append('image', imageFile);
      }

      const response = await fetch('/api/admin/festivals', {
        method: 'POST',
        body: uploadFormData,
      });

      if (response.ok) {
        router.push('/events');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating festival:', error);
      alert('Failed to create festival');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] mb-8 -mx-6 -mt-6 px-6 py-4">
          <h1 className="folio-h2 text-[var(--text-primary)]">Create New Festival</h1>
          <p className="folio-body text-[var(--text-secondary)] mt-1">Set up a new festival to showcase design events and connect the community</p>
        </div>

        <div className="max-w-2xl">
          <RidgeCard padding="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="title" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                  Festival Title *
                </label>
                <Input
                  type="text"
                  id="title"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter festival title"
                />
              </div>

              <div>
                <label htmlFor="description" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="ridge-input w-full"
                  placeholder="Describe the festival"
                />
              </div>

              <div>
                <label htmlFor="location" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                  Location *
                </label>
                <Input
                  type="text"
                  id="location"
                  name="location"
                  required
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Enter location (e.g., Convention Center, Downtown Plaza)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                    City
                  </label>
                  <Input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                    State/Province
                  </label>
                  <Input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="State/Province"
                  />
                </div>

                <div>
                  <label htmlFor="country" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                    Country
                  </label>
                  <Input
                    type="text"
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="Country"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="image" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                  Festival Image (optional)
                </label>
                <input
                  type="file"
                  id="image"
                  name="image"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="ridge-input w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                    Start Date *
                  </label>
                  <Input
                    type="date"
                    id="startDate"
                    name="startDate"
                    required
                    value={formData.startDate}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="endDate" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                    End Date *
                  </label>
                  <Input
                    type="date"
                    id="endDate"
                    name="endDate"
                    required
                    value={formData.endDate}
                    onChange={handleChange}
                    min={formData.startDate}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-[var(--border-subtle)]">
                <Button
                  type="submit"
                  disabled={isLoading}
                  variant="accent"
                  className="flex-1"
                >
                  {isLoading ? 'Creating...' : 'Create Festival'}
                </Button>

                <Button
                  type="button"
                  onClick={() => router.back()}
                  variant="ridge"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </RidgeCard>
        </div>
      </div>
    </div>
  );
}
