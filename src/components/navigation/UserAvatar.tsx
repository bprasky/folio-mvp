import Image from "next/image";
import { User } from "lucide-react";

interface UserAvatarProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export function UserAvatar({ src, alt = "User", size = "md" }: UserAvatarProps) {
  const sizeClass = sizes[size];

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={40}
        height={40}
        className={`${sizeClass} rounded-full object-cover border border-folio-border-subtle`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-surface-ground border border-folio-border-subtle flex items-center justify-center`}>
      <User className="h-5 w-5 text-folio-text-tertiary" />
    </div>
  );
}

