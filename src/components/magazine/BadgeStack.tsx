// src/components/magazine/BadgeStack.tsx
//
// Badge Stack Component
//
// Displays editorial badges earned by content:
// - Editor's Pick (gold star)
// - Trending (flame)
// - Featured (sparkle)
// - Rising Star (rocket)
// - Staff Favorite (heart)

import clsx from "clsx";

export type BadgeType =
  | "EDITORS_PICK"
  | "TRENDING"
  | "FEATURED"
  | "RISING_STAR"
  | "STAFF_FAVORITE";

interface Badge {
  type: BadgeType;
  earnedAt?: Date;
}

interface BadgeStackProps {
  badges: Badge[];
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
  maxDisplay?: number;
}

// Badge configuration
const BADGE_CONFIG: Record<
  BadgeType,
  { icon: string; label: string; color: string; bgColor: string }
> = {
  EDITORS_PICK: {
    icon: "\u2605", // Star
    label: "Editor's Pick",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  TRENDING: {
    icon: "\uD83D\uDD25", // Fire emoji
    label: "Trending",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  FEATURED: {
    icon: "\u2728", // Sparkles
    label: "Featured",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  RISING_STAR: {
    icon: "\uD83D\uDE80", // Rocket emoji
    label: "Rising Star",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  STAFF_FAVORITE: {
    icon: "\u2665", // Heart
    label: "Staff Favorite",
    color: "text-rose-600",
    bgColor: "bg-rose-50",
  },
};

// Size configurations
const SIZE_CONFIG = {
  sm: {
    container: "text-xs",
    icon: "text-sm",
    padding: "px-1.5 py-0.5",
    gap: "-space-x-1",
  },
  md: {
    container: "text-sm",
    icon: "text-base",
    padding: "px-2 py-1",
    gap: "-space-x-1.5",
  },
  lg: {
    container: "text-base",
    icon: "text-lg",
    padding: "px-3 py-1.5",
    gap: "-space-x-2",
  },
};

export default function BadgeStack({
  badges,
  size = "md",
  showLabel = false,
  className,
  maxDisplay = 3,
}: BadgeStackProps) {
  if (!badges.length) return null;

  const sizeConfig = SIZE_CONFIG[size];
  const displayBadges = badges.slice(0, maxDisplay);
  const remainingCount = badges.length - maxDisplay;

  // Single badge with optional label
  if (badges.length === 1 || showLabel) {
    const badge = badges[0];
    const config = BADGE_CONFIG[badge.type];
    return (
      <div
        className={clsx(
          "inline-flex items-center gap-1 rounded-full",
          config.bgColor,
          sizeConfig.padding,
          sizeConfig.container,
          className
        )}
      >
        <span className={clsx(config.color, sizeConfig.icon)}>{config.icon}</span>
        {showLabel && (
          <span className={clsx(config.color, "font-medium")}>{config.label}</span>
        )}
      </div>
    );
  }

  // Stacked badges
  return (
    <div className={clsx("inline-flex", sizeConfig.gap, className)}>
      {displayBadges.map((badge, index) => {
        const config = BADGE_CONFIG[badge.type];
        return (
          <div
            key={`${badge.type}-${index}`}
            className={clsx(
              "inline-flex items-center justify-center rounded-full border-2 border-white shadow-sm",
              config.bgColor,
              sizeConfig.padding
            )}
            title={config.label}
            style={{ zIndex: displayBadges.length - index }}
          >
            <span className={clsx(config.color, sizeConfig.icon)}>{config.icon}</span>
          </div>
        );
      })}
      {remainingCount > 0 && (
        <div
          className={clsx(
            "inline-flex items-center justify-center rounded-full border-2 border-white shadow-sm",
            "bg-neutral-100",
            sizeConfig.padding
          )}
          title={`+${remainingCount} more`}
          style={{ zIndex: 0 }}
        >
          <span className={clsx("text-neutral-600 font-medium", sizeConfig.container)}>
            +{remainingCount}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Standalone single badge component
 */
export function SingleBadge({
  type,
  size = "md",
  showLabel = true,
  className,
}: {
  type: BadgeType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const config = BADGE_CONFIG[type];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1 rounded-full",
        config.bgColor,
        sizeConfig.padding,
        sizeConfig.container,
        className
      )}
    >
      <span className={clsx(config.color, sizeConfig.icon)}>{config.icon}</span>
      {showLabel && (
        <span className={clsx(config.color, "font-medium")}>{config.label}</span>
      )}
    </div>
  );
}

/**
 * Badge icon only (for compact displays)
 */
export function BadgeIcon({
  type,
  size = "md",
  className,
}: {
  type: BadgeType;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const config = BADGE_CONFIG[type];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <span
      className={clsx(config.color, sizeConfig.icon, className)}
      title={config.label}
    >
      {config.icon}
    </span>
  );
}
