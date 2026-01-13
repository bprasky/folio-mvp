import Image from "next/image";
import { User } from "lucide-react";

interface UserAvatarWithBadgeProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg";
  firmLogo?: string | null;
}

const sizes = {
  sm: {
    container: "h-8 w-8",
    avatar: "h-8 w-8",
    badge: "h-5 w-5",
    offset: "-bottom-0.5 -right-0.5",
    iconSize: "h-4 w-4",
  },
  md: {
    container: "h-10 w-10",
    avatar: "h-10 w-10",
    badge: "h-6 w-6",
    offset: "-bottom-0.5 -right-0.5",
    iconSize: "h-5 w-5",
  },
  lg: {
    container: "h-12 w-12",
    avatar: "h-12 w-12",
    badge: "h-7 w-7",
    offset: "-bottom-1 -right-1",
    iconSize: "h-6 w-6",
  },
};

/**
 * UserAvatarWithBadge - Renders user avatar with optional firm logo badge
 *
 * When a user belongs to an organization, the org logo appears as a subtle
 * badge/shadow in the bottom-right corner of the avatar.
 */
export function UserAvatarWithBadge({
  src,
  alt = "User",
  size = "md",
  firmLogo,
}: UserAvatarWithBadgeProps) {
  const sizeConfig = sizes[size];

  return (
    <div className={`relative ${sizeConfig.container}`}>
      {/* Main avatar */}
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={48}
          height={48}
          className={`${sizeConfig.avatar} rounded-full object-cover border border-neutral-200`}
        />
      ) : (
        <div className={`${sizeConfig.avatar} rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center`}>
          <User className={`${sizeConfig.iconSize} text-neutral-400`} />
        </div>
      )}

      {/* Firm logo badge - only show if firmLogo is provided */}
      {firmLogo && (
        <div
          className={`absolute ${sizeConfig.offset} ${sizeConfig.badge} rounded-full bg-white border border-neutral-200 shadow-sm overflow-hidden flex items-center justify-center`}
        >
          <Image
            src={firmLogo}
            alt="Firm"
            width={28}
            height={28}
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Original UserAvatar component for backwards compatibility
 * This is the same as before without the badge functionality
 */
export function UserAvatar({ src, alt = "User", size = "md" }: Omit<UserAvatarWithBadgeProps, 'firmLogo'>) {
  return <UserAvatarWithBadge src={src} alt={alt} size={size} />;
}
