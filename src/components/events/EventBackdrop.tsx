import Image from "next/image";

type Props = {
  src?: string | null;
  alt?: string;
};

export default function EventBackdrop({ src, alt = "Event background" }: Props) {
  return (
    <div className="absolute inset-0 -z-10">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority
          className="object-cover"
          unoptimized   // ← ensures we still render even if a new host appears
        />
      ) : (
        <div className="h-full w-full bg-neutral-200 dark:bg-neutral-800" />
      )}
      {/* Scrim to keep content readable */}
      <div className="absolute inset-0 bg-black/30" />
      {/* Soft vignette at top/bottom */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}
