import React from 'react';
import Image from 'next/image';

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
    <div className="bg-white rounded-lg shadow-md p-6">
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
          <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
          <p className="mt-2 text-gray-600">{bio}</p>

          {Object.keys(socialLinks).length > 0 && (
            <div className="mt-4 flex justify-center md:justify-start gap-4">
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Instagram
                </a>
              )}
              {socialLinks.linkedin && (
                <a
                  href={socialLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900"
                >
                  LinkedIn
                </a>
              )}
              {socialLinks.website && (
                <a
                  href={socialLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900"
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
                  <p className="text-2xl font-bold text-gray-900">{metrics.followers}</p>
                  <p className="text-sm text-gray-600">Followers</p>
                </div>
              )}
              {metrics.following !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{metrics.following}</p>
                  <p className="text-sm text-gray-600">Following</p>
                </div>
              )}
              {metrics.products !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{metrics.products}</p>
                  <p className="text-sm text-gray-600">Products</p>
                </div>
              )}
              {metrics.events !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{metrics.events}</p>
                  <p className="text-sm text-gray-600">Events</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 