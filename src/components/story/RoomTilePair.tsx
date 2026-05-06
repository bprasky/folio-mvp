"use client";

// RoomTilePair — Layout wrapper that places PhotoTile + QuoteTile
// into the mosaic grid according to pattern (1-4).
//
// Pattern 1: photo left, quote right (half-width each)
// Pattern 2: quote left, photo right (half-width each)
// Pattern 3: full-width photo, wide quote bar below
// Pattern 4: full-width photo, two split quote tiles below
//
// Patterns 3/4 fall back to a side-by-side layout when the photo's natural
// aspect can't go full-bleed without overflowing the viewport (portrait or
// square ratios). The QuoteTile then fills the space the constrained photo
// leaves instead of stacking awkwardly below a centered fragment.

import { PhotoTile } from "./PhotoTile";
import { QuoteTile } from "./QuoteTile";
import { useImageAspect } from "./useImageAspect";
import type { RoomTileData } from "@/lib/story/buildRoomTiles";

interface RoomTilePairProps {
  room: RoomTileData;
  /** 0-based index in the mosaic — drives strict L/R photo alternation. */
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onProductClick?: (product: any) => void;
  reducedMotion: boolean;
}

export function RoomTilePair({
  room,
  index,
  isExpanded,
  onToggle,
  onProductClick,
  reducedMotion,
}: RoomTilePairProps) {
  const { pattern } = room;
  // Strict L/R alternation by mosaic index — overrides the pattern's own
  // photo-side decision so Pattern 1, Pattern 2, and the Pattern 3/4
  // portrait fall-through all share the same rhythm.
  const photoLeft = index % 2 === 0;

  if (pattern === 3) {
    return (
      <Pattern3
        room={room}
        photoLeft={photoLeft}
        isExpanded={isExpanded}
        onToggle={onToggle}
        onProductClick={onProductClick}
        reducedMotion={reducedMotion}
      />
    );
  }

  if (pattern === 4) {
    return (
      <Pattern4
        room={room}
        photoLeft={photoLeft}
        isExpanded={isExpanded}
        onToggle={onToggle}
        onProductClick={onProductClick}
        reducedMotion={reducedMotion}
      />
    );
  }

  // Pattern 1 or 2: photo side now driven by index parity, not pattern id.
  const photoFirst = photoLeft;

  return (
    <>
      <div
        className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-[10px] items-center"
        id={`room-${room.roomSlug}`}
      >
        {photoFirst ? (
          <>
            <PhotoTile
              imageUrl={room.heroImage.url}
              alt={room.roomLabel}
              image={room.heroImage}
              onClick={onToggle}
              onProductClick={onProductClick}
              isExpanded={isExpanded}
              reducedMotion={reducedMotion}
            />
            <QuoteTile
              roomLabel={room.roomLabel}
              pullQuote={room.pullQuote}
              attribution={room.attribution}
              productCount={room.productCount}
              editorialTeaser={room.editorialTeaser}
              editorialNarrative={room.editorialNarrative}
              onClick={onToggle}
              isExpanded={isExpanded}
              reducedMotion={reducedMotion}
            />
          </>
        ) : (
          <>
            <QuoteTile
              roomLabel={room.roomLabel}
              pullQuote={room.pullQuote}
              attribution={room.attribution}
              productCount={room.productCount}
              editorialTeaser={room.editorialTeaser}
              editorialNarrative={room.editorialNarrative}
              onClick={onToggle}
              isExpanded={isExpanded}
              reducedMotion={reducedMotion}
            />
            <PhotoTile
              imageUrl={room.heroImage.url}
              alt={room.roomLabel}
              image={room.heroImage}
              onClick={onToggle}
              onProductClick={onProductClick}
              isExpanded={isExpanded}
              reducedMotion={reducedMotion}
            />
          </>
        )}
      </div>
    </>
  );
}

// Pattern 3: Full-width photo + wide quote bar below
function Pattern3({
  room,
  photoLeft,
  isExpanded,
  onToggle,
  onProductClick,
  reducedMotion,
}: Omit<RoomTilePairProps, "index"> & { photoLeft: boolean }) {
  const aspect = useImageAspect(
    room.heroImage.url,
    (room.heroImage as any).width,
    (room.heroImage as any).height,
  );
  // Landscape or unresolved → keep the dramatic full-bleed stack. Otherwise
  // fall through to the half-and-half alternating layout so the photo sits
  // next to the quote, with photo side driven by mosaic index parity.
  const fallThrough = aspect.frame === "portrait" || aspect.frame === "square";

  if (fallThrough) {
    const photo = (
      <PhotoTile
        imageUrl={room.heroImage.url}
        alt={room.roomLabel}
        image={room.heroImage}
        onClick={onToggle}
        onProductClick={onProductClick}
        isExpanded={isExpanded}
        reducedMotion={reducedMotion}
      />
    );
    const quote = (
      <QuoteTile
        roomLabel={room.roomLabel}
        pullQuote={room.pullQuote}
        attribution={room.attribution}
        productCount={room.productCount}
        editorialTeaser={room.editorialTeaser}
        editorialNarrative={room.editorialNarrative}
        onClick={onToggle}
        isExpanded={isExpanded}
        reducedMotion={reducedMotion}
      />
    );
    return (
      <div
        className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-[10px] items-center"
        id={`room-${room.roomSlug}`}
      >
        {photoLeft ? <>{photo}{quote}</> : <>{quote}{photo}</>}
      </div>
    );
  }

  return (
    <div className="col-span-2 flex flex-col gap-[10px]" id={`room-${room.roomSlug}`}>
      <PhotoTile
        imageUrl={room.heroImage.url}
        alt={room.roomLabel}
        image={room.heroImage}
        onClick={onToggle}
        onProductClick={onProductClick}
        fullWidth
        isExpanded={isExpanded}
        reducedMotion={reducedMotion}
      />
      <QuoteTile
        roomLabel={room.roomLabel}
        pullQuote={room.pullQuote}
        attribution={room.attribution}
        productCount={room.productCount}
        editorialNarrative={room.editorialNarrative}
        onClick={onToggle}
        isExpanded={isExpanded}
        wide
        reducedMotion={reducedMotion}
      />
    </div>
  );
}

// Pattern 4: Full-width photo + split quote tiles below
function Pattern4({
  room,
  photoLeft,
  isExpanded,
  onToggle,
  onProductClick,
  reducedMotion,
}: Omit<RoomTilePairProps, "index"> & { photoLeft: boolean }) {
  const aspect = useImageAspect(
    room.heroImage.url,
    (room.heroImage as any).width,
    (room.heroImage as any).height,
  );
  const fallThrough = aspect.frame === "portrait" || aspect.frame === "square";

  const secondaryQuote = room.editorialTeaser ? (
    <QuoteTile
      roomLabel=""
      pullQuote={null}
      attribution=""
      productCount={0}
      editorialTeaser={room.editorialTeaser}
      onClick={onToggle}
      isExpanded={isExpanded}
      reducedMotion={reducedMotion}
    />
  ) : (
    <QuoteTile
      roomLabel={room.roomLabel}
      pullQuote={room.pullQuote}
      attribution={room.attribution}
      productCount={0}
      onClick={onToggle}
      isExpanded={isExpanded}
      reducedMotion={reducedMotion}
    />
  );

  if (fallThrough) {
    // Same fallback as Pattern 3 — photo + primary quote in the alternating
    // half-width layout. The split-quote / editorial teaser is dropped here
    // because there is no full-width strip below it to host the second tile;
    // keeping both would re-introduce the awkward stacking we were avoiding.
    const photo = (
      <PhotoTile
        imageUrl={room.heroImage.url}
        alt={room.roomLabel}
        image={room.heroImage}
        onClick={onToggle}
        onProductClick={onProductClick}
        isExpanded={isExpanded}
        reducedMotion={reducedMotion}
      />
    );
    const quote = (
      <QuoteTile
        roomLabel={room.roomLabel}
        pullQuote={room.pullQuote}
        attribution={room.attribution}
        productCount={room.productCount}
        editorialTeaser={room.editorialTeaser}
        editorialNarrative={room.editorialNarrative}
        onClick={onToggle}
        isExpanded={isExpanded}
        reducedMotion={reducedMotion}
      />
    );
    return (
      <div
        className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-[10px] items-center"
        id={`room-${room.roomSlug}`}
      >
        {photoLeft ? <>{photo}{quote}</> : <>{quote}{photo}</>}
      </div>
    );
  }

  return (
    <div className="col-span-2 flex flex-col gap-[10px]" id={`room-${room.roomSlug}`}>
      <PhotoTile
        imageUrl={room.heroImage.url}
        alt={room.roomLabel}
        image={room.heroImage}
        onClick={onToggle}
        onProductClick={onProductClick}
        fullWidth
        isExpanded={isExpanded}
        reducedMotion={reducedMotion}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
        <QuoteTile
          roomLabel={room.roomLabel}
          pullQuote={room.pullQuote}
          attribution={room.attribution}
          productCount={room.productCount}
          editorialNarrative={room.editorialNarrative}
          onClick={onToggle}
          isExpanded={isExpanded}
          reducedMotion={reducedMotion}
        />
        {secondaryQuote}
      </div>
    </div>
  );
}
