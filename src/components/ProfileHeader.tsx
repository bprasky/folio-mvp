import React from 'react';
import Image from '@/components/FolioImage';

interface ProfileHeaderProps {
  name: string;
  bio: string;
  profileImage: string;
  socialLinks?: {
    instagram?: string;
    linkedin?: string;
    website?: string;
  };
  metrics?: {
    followers?: number;
    following?: number;
    products?: number;
    events?: number;
  };
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  name,
  bio,
  profileImage,
  socialLinks = {},
  metrics = {},
}) => {
  return (
    <div className="glass-surface p-6">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
        <div className="relative h-32 w-32 rounded-full overflow-hidden">
          <Image
            src={profileImage}
            alt={name}
            fill
            className="object-cover"
          />
        </div>

        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl font-bold text-folio-text-primary">{name}</h1>
          <p className="mt-2 text-folio-text-secondary">{bio}</p>

          {Object.keys(socialLinks).length > 0 && (
            <div className="mt-4 flex justify-center md:justify-start gap-4">
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-folio-text-secondary hover:text-folio-text-primary"
                >
                  Instagram
                </a>
              )}
              {socialLinks.linkedin && (
                <a
                  href={socialLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-folio-text-secondary hover:text-folio-text-primary"
                >
                  LinkedIn
                </a>
              )}
              {socialLinks.website && (
                <a
                  href={socialLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-folio-text-secondary hover:text-folio-text-primary"
                >
                  Website
                </a>
              )}
            </div>
          )}

          {Object.keys(metrics).length > 0 && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.followers !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-folio-text-primary">{metrics.followers}</p>
                  <p className="text-sm text-folio-text-secondary">Followers</p>
                </div>
              )}
              {metrics.following !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-folio-text-primary">{metrics.following}</p>
                  <p className="text-sm text-folio-text-secondary">Following</p>
                </div>
              )}
              {metrics.products !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-folio-text-primary">{metrics.products}</p>
                  <p className="text-sm text-folio-text-secondary">Products</p>
                </div>
              )}
              {metrics.events !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-folio-text-primary">{metrics.events}</p>
                  <p className="text-sm text-folio-text-secondary">Events</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 