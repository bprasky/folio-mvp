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
  isExpanded: boolean;
  onToggle: () => void;
  onProductClick?: (product: any) => void;
  reducedMotion: boolean;
}

export function RoomTilePair({
  room,
  isExpanded,
  onToggle,
  onProductClick,
  reducedMotion,
}: RoomTilePairProps) {
  const { pattern } = room;

  if (pattern === 3) {
    return (
      <Pattern3
        room={room}
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
        isExpanded={isExpanded}
        onToggle={onToggle}
        onProductClick={onProductClick}
        reducedMotion={reducedMotion}
      />
    );
  }

  // Pattern 1 or 2
  const photoFirst = pattern === 1;

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
  isExpanded,
  onToggle,
  onProductClick,
  reducedMotion,
}: RoomTilePairProps) {
  const aspect = useImageAspect(
    room.heroImage.url,
    (room.heroImage as any).width,
    (room.heroImage as any).height,
  );
  // Landscape or unresolved → keep the dramatic full-bleed stack. Otherwise
  // photo and quote sit beside each other so the quote uses the space the
  // height-capped photo leaves.
  const sideBySide = aspect.frame === "portrait" || aspect.frame === "square";

  if (sideBySide) {
    return (
      <div
        className="col-span-2 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-[10px] md:gap-6 items-center"
        id={`room-${room.roomSlug}`}
      >
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
        <div className="w-full md:min-w-0">
          <QuoteTile
            roomLabel={room.roomLabel}
            pullQuote={room.pullQuote}
            attribution={room.attribution}
            productCount={room.productCount}
            editorialTeaser={room.editorialTeaser}
            onClick={onToggle}
            isExpanded={isExpanded}
            wide
            reducedMotion={reducedMotion}
          />
        </div>
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
  isExpanded,
  onToggle,
  onProductClick,
  reducedMotion,
}: RoomTilePairProps) {
  const aspect = useImageAspect(
    room.heroImage.url,
    (room.heroImage as any).width,
    (room.heroImage as any).height,
  );
  const sideBySide = aspect.frame === "portrait" || aspect.frame === "square";

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

  if (sideBySide) {
    // Photo on one side, the two quote tiles stacked on the other so the
    // editorial teaser still gets its own surface alongside the photo.
    return (
      <div
        className="col-span-2 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-[10px] md:gap-6 items-center"
        id={`room-${room.roomSlug}`}
      >
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
        <div className="w-full md:min-w-0 flex flex-col gap-[10px]">
          <QuoteTile
            roomLabel={room.roomLabel}
            pullQuote={room.pullQuote}
            attribution={room.attribution}
            productCount={room.productCount}
            onClick={onToggle}
            isExpanded={isExpanded}
            reducedMotion={reducedMotion}
          />
          {secondaryQuote}
        </div>
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
          onClick={onToggle}
          isExpanded={isExpanded}
          reducedMotion={reducedMotion}
        />
        {secondaryQuote}
      </div>
    </div>
  );
}
