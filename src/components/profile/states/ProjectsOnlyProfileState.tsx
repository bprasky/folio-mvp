"use client";
import { useMemo } from "react";
import Link from "next/link";
import DefaultShell from "../shells/DefaultShell";
import ProfileProgressIndicator from "../ProfileProgressIndicator";
import { ProfileContext } from "@/lib/aesthetic/types";

type Props = {
  designer: ProfileContext["designer"];
  projects: ProfileContext["projects"];
  viewerContext?: ProfileContext["viewerContext"];
  isOwner: boolean;
};

export default function ProjectsOnlyProfileState({
  designer,
  projects,
  viewerContext,
  isOwner,
}: Props) {
  const preliminaryAesthetic = useMemo(() => {
    if (projects.length >= 2) {
      // Enough for detection - let parent trigger detection
      return null;
    }
    // With 1 project, show default with hint
    return {
      theme: "default" as const,
      confidence: 0.3,
      signals: {
        colorTemperature: "neutral" as const,
        density: "balanced" as const,
        contrast: "medium" as const,
        dominantMaterials: [],
        spatialStyle: "mixed",
      },
      explanation: "",
      alternativeThemes: [],
    };
  }, [projects.length]);

  const aesthetic = preliminaryAesthetic || {
    theme: "default" as const,
    confidence: 0.3,
    signals: {
      colorTemperature: "neutral" as const,
      density: "balanced" as const,
      contrast: "medium" as const,
      dominantMaterials: [],
      spatialStyle: "mixed",
    },
    explanation: "",
    alternativeThemes: [],
  };

  if (!isOwner) {
    // Public view - show projects in default layout
    return (
      <DefaultShell
        designer={designer}
        projects={projects}
        aesthetic={aesthetic}
        viewerContext={viewerContext}
      />
    );
  }

  // Owner view - show projects + brand suggestion
  return (
    <div className="min-h-screen bg-white">
      {/* Suggestion banner */}
      <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-sm text-blue-800">
            {projects.length === 1
              ? "Add one more project to unlock your personalized profile."
              : "Add your brand assets to refine your profile's look."}
          </p>
          <Link
            href={projects.length === 1 ? "/designer/projects/new" : "/designer/brand"}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            {projects.length === 1 ? "Add Project" : "Add Brand"}
          </Link>
        </div>
      </div>

      {/* Render default shell with projects */}
      <DefaultShell
        designer={designer}
        projects={projects}
        aesthetic={aesthetic}
        viewerContext={viewerContext}
      />

      {/* Progress indicator for owner */}
      <ProfileProgressIndicator
        projectCount={projects.length}
        hasBrandAssets={false}
        hasAestheticProfile={false}
      />
    </div>
  );
}


