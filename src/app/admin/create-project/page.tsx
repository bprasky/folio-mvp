'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CreateProjectPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    client: '',
    designerId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/admin/projects');
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setError('You must be signed in as ADMIN.');
        } else if (response.status === 403) {
          setError('Your role is not permitted to create admin projects.');
        } else {
          setError(errorData.error || 'Failed to create project');
        }
      }
    } catch (error) {
      console.error('Error creating project:', error);
      setError('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] pl-20 lg:pl-56">
      <div className="p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="folio-h1 text-[var(--text-primary)]">Create Project</h1>
          <p className="folio-body text-[var(--text-secondary)]">Add a new project to the platform</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <RidgeCard padding="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                  Project Name *
                </label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label htmlFor="description" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="ridge-input w-full"
                  placeholder="Describe the project"
                />
              </div>

              <div>
                <label htmlFor="category" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                  Project Category *
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="ridge-input w-full"
                >
                  <option value="">Select category</option>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="hospitality">Hospitality</option>
                  <option value="retail">Retail</option>
                </select>
              </div>

              <div>
                <label htmlFor="client" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                  Client
                </label>
                <Input
                  type="text"
                  id="client"
                  name="client"
                  value={formData.client}
                  onChange={handleInputChange}
                  placeholder="Client name"
                />
              </div>

              <div>
                <label htmlFor="designerId" className="block folio-meta font-medium text-[var(--text-primary)] mb-2">
                  Designer ID *
                </label>
                <Input
                  type="text"
                  id="designerId"
                  name="designerId"
                  value={formData.designerId}
                  onChange={handleInputChange}
                  required
                  placeholder="Designer user ID"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 folio-meta">{error}</p>
                </div>
              )}

              <div className="pt-6 border-t border-[var(--border-subtle)] flex justify-end">
                <Button
                  type="submit"
                  disabled={loading}
                  variant="accent"
                >
                  {loading ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </RidgeCard>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectPage;
