'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  FaUser,
  FaEnvelope,
  FaMapMarkerAlt,
  FaGlobe,
  FaInstagram,
  FaLinkedin,
  FaSave,
  FaArrowLeft,
  FaBuilding,
  FaEye,
  FaEyeSlash,
  FaCrown,
  FaShieldAlt,
  FaStar,
  FaCheck,
  FaRocket,
  FaPalette,
  FaStore,
} from 'react-icons/fa';
import Link from 'next/link';

interface OrgMembership {
  id: string;
  role: string;
  showOnProfile: boolean;
  joinedAt: string;
  org: {
    id: string;
    name: string;
    type: string;
    status: string;
    logo?: string;
  };
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio?: string;
  location?: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  profileImage?: string;
  role: string;
  orgMemberships?: OrgMembership[];
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    location: '',
    website: '',
    instagram: '',
    linkedin: '',
  });
  const [orgMemberships, setOrgMemberships] = useState<OrgMembership[]>([]);
  const [togglingVisibility, setTogglingVisibility] = useState<string | null>(null);

  const toggleOrgVisibility = async (membershipId: string, currentValue: boolean) => {
    setTogglingVisibility(membershipId);
    try {
      const response = await fetch(`/api/auth/me/orgs/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnProfile: !currentValue }),
      });

      if (response.ok) {
        const updated = await response.json();
        setOrgMemberships(prev =>
          prev.map(m => m.id === membershipId ? updated : m)
        );
      }
    } catch (error) {
      console.error('Error toggling org visibility:', error);
    } finally {
      setTogglingVisibility(null);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setProfile(userData);
        setFormData({
          name: userData.name || '',
          bio: userData.bio || '',
          location: userData.location || '',
          website: userData.website || '',
          instagram: userData.instagram || '',
          linkedin: userData.linkedin || '',
        });
        setOrgMemberships(userData.orgMemberships || []);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Not Found</h3>
          <p className="text-gray-500 mb-4">Unable to load your profile information.</p>
          <Link
            href="/"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-2">Manage your account information and preferences</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          {/* Profile Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  {profile.profileImage ? (
                    <img
                      src={profile.profileImage}
                      alt={profile.name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <FaUser className="w-8 h-8 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
                  <p className="text-gray-600">{profile.email}</p>
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-1 capitalize">
                    {profile.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6">
            {isEditing ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bio
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location
                    </label>
                    <div className="relative">
                      <FaMapMarkerAlt className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="City, State"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <div className="relative">
                      <FaGlobe className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://yourwebsite.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instagram
                    </label>
                    <div className="relative">
                      <FaInstagram className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={formData.instagram}
                        onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="@username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      LinkedIn
                    </label>
                    <div className="relative">
                      <FaLinkedin className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="url"
                        value={formData.linkedin}
                        onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://linkedin.com/in/username"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                  >
                    <FaSave className="mr-2" />
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name</label>
                      <p className="text-gray-900">{profile.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="text-gray-900">{profile.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Bio</label>
                      <p className="text-gray-900">{profile.bio || 'No bio added yet'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Location</label>
                      <p className="text-gray-900">{profile.location || 'No location specified'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Social Links</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Website</label>
                      {profile.website ? (
                        <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          {profile.website}
                        </a>
                      ) : (
                        <p className="text-gray-500">No website added</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Instagram</label>
                      {profile.instagram ? (
                        <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          {profile.instagram}
                        </a>
                      ) : (
                        <p className="text-gray-500">No Instagram added</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">LinkedIn</label>
                      {profile.linkedin ? (
                        <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          {profile.linkedin}
                        </a>
                      ) : (
                        <p className="text-gray-500">No LinkedIn added</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upgrade to Professional CTA - Only for INDIVIDUAL users without orgs */}
        {profile.role === 'INDIVIDUAL' && orgMemberships.length === 0 && (
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg mt-6 overflow-hidden">
            <div className="px-6 py-8 sm:px-8 sm:py-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <FaRocket className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">
                    Unlock Professional Features
                  </h3>
                  <p className="text-white/90 text-sm mb-4">
                    Are you a designer or vendor? Join or create an organization to unlock project creation,
                    image generation, client management, and affiliate earnings.
                  </p>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <FaPalette className="w-4 h-4" />
                      <span>Design Firms</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <FaStore className="w-4 h-4" />
                      <span>Vendors & Manufacturers</span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto">
                  <Link
                    href="/professionals/join"
                    className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-purple-50 transition-colors shadow-md"
                  >
                    Get Started
                    <FaRocket className="ml-2 w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Organization Memberships */}
        <div className="bg-white rounded-lg shadow-sm mt-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Organization Memberships</h3>
              <Link
                href="/professionals/join"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Join an Organization
              </Link>
            </div>
          </div>

          <div className="p-6">
            {orgMemberships.length === 0 ? (
              <div className="text-center py-8">
                <FaBuilding className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h4 className="text-gray-900 font-medium mb-2">No Organization Memberships</h4>
                <p className="text-gray-500 text-sm mb-4">
                  Join an organization to unlock professional features like project creation, image generation, and affiliate earnings.
                </p>
                <Link
                  href="/professionals/join"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <FaBuilding className="mr-2" />
                  Browse Organizations
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orgMemberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        {membership.org.logo ? (
                          <img
                            src={membership.org.logo}
                            alt={membership.org.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <FaBuilding className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <Link
                          href={`/org/${membership.org.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {membership.org.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-gray-500">
                            {membership.org.type.replace('_', ' ')}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="flex items-center gap-1 text-sm text-gray-500">
                            {membership.role === 'OWNER' && (
                              <FaCrown className="text-amber-500" />
                            )}
                            {membership.role === 'ADMIN' && (
                              <FaShieldAlt className="text-blue-500" />
                            )}
                            {membership.role.toLowerCase()}
                          </span>
                          {membership.org.status === 'PROFESSIONAL' && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="flex items-center gap-1 text-sm text-purple-600">
                                <FaStar className="text-purple-500" />
                                Pro
                              </span>
                            </>
                          )}
                          {membership.org.status === 'CLAIMED' && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="flex items-center gap-1 text-sm text-blue-600">
                                <FaCheck className="text-blue-500" />
                                Verified
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleOrgVisibility(membership.id, membership.showOnProfile)}
                        disabled={togglingVisibility === membership.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                          membership.showOnProfile
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        } ${togglingVisibility === membership.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={membership.showOnProfile ? 'Visible on public profile' : 'Hidden from public profile'}
                      >
                        {membership.showOnProfile ? (
                          <>
                            <FaEye className="w-4 h-4" />
                            <span>Visible</span>
                          </>
                        ) : (
                          <>
                            <FaEyeSlash className="w-4 h-4" />
                            <span>Hidden</span>
                          </>
                        )}
                      </button>

                      <Link
                        href={`/org/${membership.org.id}`}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200"
                      >
                        View Org
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 