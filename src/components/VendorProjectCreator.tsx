'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Organization {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  companyName?: string;
}

interface VendorProjectCreatorProps {
  vendorUserId: string;
  vendorOrgId: string;
}

export default function VendorProjectCreator({ vendorUserId, vendorOrgId }: VendorProjectCreatorProps) {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [designerEmail, setDesignerEmail] = useState('');
  const [designerOrgId, setDesignerOrgId] = useState('');
  const [initialRooms, setInitialRooms] = useState<string[]>(['Kitchen']);
  const [designerOrgs, setDesignerOrgs] = useState<Organization[]>([]);
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [vendorRep, setVendorRep] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch vendor info and designer organizations
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch vendor organization info
        const vendorResponse = await fetch(`/api/organizations/${vendorOrgId}`);
        if (vendorResponse.ok) {
          const vendorData = await vendorResponse.json();
          setVendorInfo(vendorData);
        }

        // Fetch current user (vendor rep) info
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setVendorRep(userData);
        }

        // Fetch designer organizations
        const designerResponse = await fetch('/api/organizations?type=DESIGN_FIRM');
        if (designerResponse.ok) {
          const orgs = await designerResponse.json();
          setDesignerOrgs(orgs);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [vendorOrgId]);

  const addRoom = () => {
    setInitialRooms([...initialRooms, '']);
  };

  const updateRoom = (index: number, value: string) => {
    const updatedRooms = [...initialRooms];
    updatedRooms[index] = value;
    setInitialRooms(updatedRooms);
  };

  const removeRoom = (index: number) => {
    if (initialRooms.length > 1) {
      const updatedRooms = initialRooms.filter((_, i) => i !== index);
      setInitialRooms(updatedRooms);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/projects/handoff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          description,
          vendorOrgId,
          designerOrgId: designerOrgId || undefined,
          designerEmail: designerEmail || undefined,
          vendorUserId,
          vendorRepId: vendorRep?.id,
          vendorRepName: vendorRep?.name,
          vendorRepEmail: vendorRep?.email,
          vendorOrgName: vendorInfo?.name,
          vendorOrgDescription: vendorInfo?.description,
          initialRooms: initialRooms.filter(room => room.trim()),
        }),
      });

      if (response.ok) {
        const project = await response.json();
        setMessage('Project created successfully! Ready for handoff.');
        
        // Redirect to project page after a short delay
        setTimeout(() => {
          router.push(`/vendor/project/${project.id}`);
        }, 2000);
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      setMessage('Error creating project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Create Project for Designer</h2>
      
      {/* Vendor Information Display */}
      {vendorInfo && vendorRep && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Vendor Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-blue-700 font-medium">Organization</p>
              <p className="text-blue-900">{vendorInfo.name}</p>
              {vendorInfo.description && (
                <p className="text-sm text-blue-600 mt-1">{vendorInfo.description}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Your Representative</p>
              <p className="text-blue-900">{vendorRep.name}</p>
              <p className="text-sm text-blue-600">{vendorRep.email}</p>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Details */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project Name *
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Modern Kitchen Renovation"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief description of the project..."
            rows={3}
          />
        </div>

        {/* Designer Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Designer Organization
          </label>
          <select
            value={designerOrgId}
            onChange={(e) => setDesignerOrgId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a design firm...</option>
            {designerOrgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Or Designer Email
          </label>
          <input
            type="email"
            value={designerEmail}
            onChange={(e) => setDesignerEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="designer@example.com"
          />
          <p className="text-sm text-gray-500 mt-1">
            Use this if the designer's organization isn't listed above
          </p>
        </div>

        {/* Initial Rooms */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Initial Rooms
          </label>
          <div className="space-y-2">
            {initialRooms.map((room, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={room}
                  onChange={(e) => updateRoom(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Room name"
                />
                {initialRooms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRoom(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addRoom}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              + Add Room
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !projectName}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating Project...' : 'Create Project & Initiate Handoff'}
        </button>

        {message && (
          <div className={`p-3 rounded-md ${
            message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
} 