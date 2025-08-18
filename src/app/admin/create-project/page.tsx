'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CreateProjectPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    budget: '',
    timeline: '',
    location: '',
    requirements: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/admin/projects');
      } else {
        console.error('Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
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
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                  placeholder="Describe the project"
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-folio-text mb-2">
                  Project Type *
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                >
                  <option value="">Select type</option>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="hospitality">Hospitality</option>
                  <option value="retail">Retail</option>
                </select>
              </div>

              <div>
                <label htmlFor="budget" className="block text-sm font-medium text-folio-text mb-2">
                  Budget
                </label>
                <input
                  type="text"
                  id="budget"
                  name="budget"
                  value={formData.budget}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                  placeholder="e.g., $50,000 - $100,000"
                />
              </div>

              <div>
                <label htmlFor="timeline" className="block text-sm font-medium text-folio-text mb-2">
                  Timeline
                </label>
                <input
                  type="text"
                  id="timeline"
                  name="timeline"
                  value={formData.timeline}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                  placeholder="e.g., 3-6 months"
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-folio-text mb-2">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                  placeholder="Project location"
                />
              </div>

              <div>
                <label htmlFor="requirements" className="block text-sm font-medium text-folio-text mb-2">
                  Requirements
                </label>
                <textarea
                  id="requirements"
                  name="requirements"
                  value={formData.requirements}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
                  placeholder="Special requirements or notes"
                />
              </div>
            </div>

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