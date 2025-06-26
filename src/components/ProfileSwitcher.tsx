'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { FaUser, FaStore, FaHome, FaToggleOn, FaToggleOff, FaChevronDown } from 'react-icons/fa';
import { useRole } from '../contexts/RoleContext';

interface Profile {
  id: string;
  name?: string;
  brandName?: string;
  location?: string;
  bio?: string;
  description?: string;
  profileImage?: string;
  logo?: string;
  avatar?: string;
  metrics?: any;
}

interface ProfileSwitcherProps {
  onProfileChange?: (profileId: string) => void;
}

export default function ProfileSwitcher({ onProfileChange }: ProfileSwitcherProps) {
  const { role, activeProfileId, setActiveProfileId } = useRole();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only show for switchable roles
  if (!['designer', 'vendor', 'homeowner'].includes(role)) return null;

  useEffect(() => {
    fetchProfiles();
  }, [role]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/profiles?role=${role}`);
      const data = await response.json();
      setProfiles(data);
      
      // Set first profile as active if none selected
      if (data.length > 0 && !activeProfileId) {
        const firstProfile = data[0];
        setActiveProfileId(firstProfile.id);
        if (onProfileChange) {
          onProfileChange(firstProfile.id);
        }
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSwitch = async (profileId: string) => {
    try {
      await fetch('/api/set-active-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, role }),
      });
      
      setActiveProfileId(profileId);
      setIsOpen(false);
      
      if (onProfileChange) {
        onProfileChange(profileId);
      }
    } catch (error) {
      console.error('Error switching profile:', error);
    }
  };

  const getActiveProfile = () => {
    return profiles.find(p => p.id === activeProfileId) || profiles[0];
  };

  const getProfileIcon = () => {
    switch (role) {
      case 'designer':
        return FaUser;
      case 'vendor':
        return FaStore;
      case 'homeowner':
        return FaHome;
      default:
        return FaUser;
    }
  };

  const getProfileImage = (profile: Profile) => {
    return profile.profileImage || profile.logo || profile.avatar || null;
  };

  const getProfileName = (profile: Profile) => {
    return profile.name || profile.brandName || `${role} Profile`;
  };

  const getProfileSubtext = (profile: Profile) => {
    if (role === 'homeowner') {
      return profile.location || '';
    } else if (role === 'vendor') {
      return profile.description || '';
    } else {
      return profile.bio || '';
    }
  };

  const activeProfile = getActiveProfile();
  const Icon = getProfileIcon();

  if (loading) {
    return (
      <div className="bg-folio-card rounded-xl p-4 mb-6 border border-folio-border">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-folio-muted rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-folio-muted rounded w-24 mb-1"></div>
            <div className="h-3 bg-folio-muted rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="bg-folio-card rounded-xl p-4 mb-6 border border-folio-border">
        <div className="text-center">
          <Icon className="w-8 h-8 text-folio-border mx-auto mb-2" />
          <p className="text-folio-text text-sm">No {role} profiles found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-folio-card rounded-xl p-4 mb-6 border border-folio-border">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 hover:bg-folio-muted rounded-lg p-2 transition-colors"
        >
          <div className="flex items-center gap-3">
            {getProfileImage(activeProfile) ? (
              <div className="relative w-10 h-10 rounded-full overflow-hidden">
                <Image
                  src={getProfileImage(activeProfile)!}
                  alt={getProfileName(activeProfile)}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 bg-folio-accent rounded-full flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </div>
            )}
            
            <div className="flex-1 text-left">
              <h3 className="font-medium text-folio-text text-sm">
                {getProfileName(activeProfile)}
              </h3>
              <p className="text-folio-border text-xs truncate max-w-[200px]">
                {getProfileSubtext(activeProfile)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-folio-border">
              {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
            </span>
            <FaChevronDown 
              className={`w-3 h-3 text-folio-border transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`} 
            />
          </div>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-folio-border z-50 max-h-64 overflow-y-auto">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileSwitch(profile.id)}
                className={`w-full flex items-center gap-3 p-3 hover:bg-folio-background transition-colors ${
                  profile.id === activeProfileId ? 'bg-folio-background' : ''
                }`}
              >
                {getProfileImage(profile) ? (
                  <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={getProfileImage(profile)!}
                      alt={getProfileName(profile)}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-folio-accent rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className="flex-1 text-left min-w-0">
                  <h4 className="font-medium text-folio-text text-sm truncate">
                    {getProfileName(profile)}
                  </h4>
                  <p className="text-folio-border text-xs truncate">
                    {getProfileSubtext(profile)}
                  </p>
                  {profile.metrics && (
                    <div className="flex gap-2 mt-1">
                      {role === 'designer' && (
                        <span className="text-xs text-folio-accent">
                          {profile.metrics.followers || 0} followers
                        </span>
                      )}
                      {role === 'vendor' && (
                        <span className="text-xs text-folio-accent">
                          {profile.metrics.products || 0} products
                        </span>
                      )}
                      {role === 'homeowner' && (
                        <span className="text-xs text-folio-accent">
                          {profile.metrics?.itemsSaved || 0} saved items
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {profile.id === activeProfileId && (
                  <FaToggleOn className="w-5 h-5 text-folio-accent flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 