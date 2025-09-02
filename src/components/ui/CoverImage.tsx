import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  // aspect ratio hint (w/h)
  ratio?: "16/9" | "4/3" | "1/1" | "3/4" | "2/3";
};

const ratioMap: Record<NonNullable<Props["ratio"]>, string> = {
  "16/9": "aspect-[16/9]",
  "4/3": "aspect-[4/3]",
  "1/1": "aspect-square",
  "3/4": "aspect-[3/4]",
  "2/3": "aspect-[2/3]",
};

export default function CoverImage({
  src,
  alt = "",
  className,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 33vw",
  ratio = "16/9",
}: Props) {
  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg", ratioMap[ratio], className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div className="h-full w-full bg-neutral-200" />
      )}
    </div>
  );
}



