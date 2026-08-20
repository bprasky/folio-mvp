"use client";

import StoryInterviewPanel from "./StoryInterviewPanel";

interface StoryPanelProps {
  projectId: string;
  project: { id: string; title: string };
  /** Photos only — documents are filtered out on the server. */
  images: Array<{
    id: string;
    url: string;
    name: string | null;
    room: string | null;
    roomId: string | null;
    displayOrder: number | null;
  }>;
  /** The project's rooms, used to index the saved answers. */
  rooms: Array<{ id: string; name: string }>;
  /** Photos with no products and no "product-free" mark, from the publish readiness. */
  untaggedPhotoCount: number;
  /** Photos that already carry at least one product tag. */
  taggedPhotoCount: number;
  isOwner: boolean;
}

/**
 * StoryPanel — the Story step's surface (step 4).
 *
 * The designer's words live here and ONLY here: the interview, the saved
 * answers, and generating the draft. The Tags step owns photos and products;
 * Publish owns the draft once it exists. Project Credits used to sit at the
 * bottom of this tab, which put "invite your collaborators" after the writing
 * was already done — it now lives on the Rooms step, before the interview.
 */
export default function StoryPanel({
  projectId,
  project,
  images,
  rooms,
  untaggedPhotoCount,
  taggedPhotoCount,
  isOwner,
}: StoryPanelProps) {
  if (!isOwner) return null;

  return (
    <div className="max-w-[1080px]">
      <StoryInterviewPanel
        projectId={projectId}
        projectName={project.title}
        images={images}
        rooms={rooms}
        untaggedPhotoCount={untaggedPhotoCount}
        taggedPhotoCount={taggedPhotoCount}
      />
    </div>
  );
}
