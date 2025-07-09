'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FaUser, FaStore, FaHome, FaToggleOn, FaToggleOff, FaChevronDown, FaSignOutAlt } from 'react-icons/fa';
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
  const { role, activeProfileId, setActiveProfileId, setRole } = useRole();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Available roles for switching
  const availableRoles = ['designer', 'vendor', 'homeowner', 'admin'];

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

  const handleRoleSwitch = async (newRole: string) => {
    try {
      // Update role in context
      setRole(newRole);
      setActiveProfileId(null);
      setIsOpen(false);
      
      // Redirect to appropriate dashboard
      switch (newRole) {
        case 'designer':
          router.push('/designer');
          break;
        case 'vendor':
          router.push('/vendor');
          break;
        case 'homeowner':
          router.push('/homeowner');
          break;
        case 'admin':
          router.push('/admin');
          break;
        default:
          router.push('/');
      }
    } catch (error) {
      console.error('Error switching role:', error);
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
      case 'admin':
        return FaUser;
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
      return profile.description || profile.bio || 'Vendor Profile';
    } else {
      return profile.bio || '';
    }
  };

  const getProfileDisplayName = (profile: Profile) => {
    if (role === 'vendor') {
      return profile.brandName || profile.name || 'Vendor Profile';
    }
    return profile.name || profile.brandName || `${role} Profile`;
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'designer':
        return 'Designer';
      case 'vendor':
        return 'Vendor';
      case 'homeowner':
        return 'Homeowner';
      case 'admin':
        return 'Admin';
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'designer':
        return FaUser;
      case 'vendor':
        return FaStore;
      case 'homeowner':
        return FaHome;
      case 'admin':
        return FaUser;
      default:
        return FaUser;
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
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-folio-border z-50 max-h-96 overflow-y-auto">
            {/* Role Switching Section */}
            <div className="p-3 border-b border-folio-border">
              <h4 className="text-xs font-medium text-folio-border mb-2">Switch Role</h4>
              <div className="space-y-1">
                {availableRoles.map((availableRole) => {
                  const RoleIcon = getRoleIcon(availableRole);
                  return (
                    <button
                      key={availableRole}
                      onClick={() => handleRoleSwitch(availableRole)}
                      className={`w-full flex items-center gap-2 p-2 rounded text-sm transition-colors ${
                        availableRole === role 
                          ? 'bg-folio-accent text-white' 
                          : 'hover:bg-folio-background text-folio-text'
                      }`}
                    >
                      <RoleIcon className="w-4 h-4" />
                      <span>{getRoleDisplayName(availableRole)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Profile Switching Section */}
            {profiles.length > 0 && (
              <div className="p-3">
                <h4 className="text-xs font-medium text-folio-border mb-2">
                  {role === 'vendor' ? 'Select Vendor Account' : `${getRoleDisplayName(role)} Profiles`}
                  {role === 'vendor' && profiles.length > 1 && (
                    <span className="ml-2 text-xs text-folio-accent font-medium">
                      ({profiles.length} available)
                    </span>
                  )}
                </h4>
                <div className="space-y-1">
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleProfileSwitch(profile.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded text-sm transition-colors ${
                        profile.id === activeProfileId 
                          ? 'bg-folio-accent text-white' 
                          : 'hover:bg-folio-background text-folio-text'
                      }`}
                    >
                      {getProfileImage(profile) ? (
                        <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                          <Image
                            src={getProfileImage(profile)!}
                            alt={getProfileName(profile)}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-folio-accent rounded-full flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                      )}
                      
                      <div className="flex-1 text-left">
                        <p className={`font-medium text-sm ${
                          profile.id === activeProfileId ? 'text-white' : 'text-folio-text'
                        }`}>
                          {role === 'vendor' ? (profile.brandName || profile.name) : getProfileName(profile)}
                          {profile.id === activeProfileId && (
                            <span className="ml-2 text-xs opacity-75">(Active)</span>
                          )}
                        </p>
                        <p className={`text-xs truncate ${
                          profile.id === activeProfileId ? 'text-white opacity-75' : 'text-folio-border'
                        }`}>
                          {getProfileSubtext(profile)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sign Out Section */}
            <div className="p-3 border-t border-folio-border">
              <button
                onClick={() => {
                  // Handle sign out
                  router.push('/auth');
                }}
                className="w-full flex items-center gap-2 p-2 rounded text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <FaSignOutAlt className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 