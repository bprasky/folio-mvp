"use client";

/**
 * AvatarRow - Displays attendee avatars for event modals
 * Folio Design System: Uses accent-tinted backgrounds with neumorphic ring
 */
export default function AvatarRow({ names, count }: { names: string[]; count: number }) {
  if (count < 5) return null;
  const show = names.slice(0, 5);
  return (
    <div className="flex items-center -space-x-2">
      {show.map((n, i) => {
        const initials = n
          .split(" ")
          .map((x) => x[0]?.toUpperCase())
          .slice(0, 2)
          .join("");
        return (
          <div
            key={i}
            className="h-7 w-7 rounded-full bg-[var(--accent)]/30 text-[10px] flex items-center justify-center ring-2 ring-[var(--bg-base)]/50 backdrop-blur-sm font-medium text-white"
            title={n}
          >
            {initials || "•"}
          </div>
        );
      })}
      {count > show.length ? (
        <div className="h-7 w-7 rounded-full bg-[var(--accent)]/30 text-[10px] flex items-center justify-center ring-2 ring-[var(--bg-base)]/50 backdrop-blur-sm font-medium text-white">
          +{count - show.length}
        </div>
      ) : null}
    </div>
  );
}

















