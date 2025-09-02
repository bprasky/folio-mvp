'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-gray-50 pl-20 lg:pl-56">
      <div className="p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-folio-text">Create Project</h1>
          <p className="text-folio-text-muted">Add a new project to the platform</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-folio-border p-6">
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-folio-text mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-folio-text mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                  placeholder="Describe the project"
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-folio-text mb-2">
                  Project Category *
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                >
                  <option value="">Select category</option>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="hospitality">Hospitality</option>
                  <option value="retail">Retail</option>
                </select>
              </div>

              <div>
                <label htmlFor="client" className="block text-sm font-medium text-folio-text mb-2">
                  Client
                </label>
                <input
                  type="text"
                  id="client"
                  name="client"
                  value={formData.client}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                  placeholder="Client name"
                />
              </div>

              <div>
                <label htmlFor="designerId" className="block text-sm font-medium text-folio-text mb-2">
                  Designer ID *
                </label>
                <input
                  type="text"
                  id="designerId"
                  name="designerId"
                  value={formData.designerId}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                  placeholder="Designer user ID"
                />
              </div>
            </div>

            {error && (
              <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectPage; 