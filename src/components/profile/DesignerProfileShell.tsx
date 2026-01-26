"use client";

import { ComponentType } from "react";
import { ProfileContext, AestheticProfile } from "@/lib/aesthetic/types";
import { DesignerFlowErrorBoundary } from "@/components/ui/DesignerFlowErrorBoundary";
import MinimalShell from "./shells/MinimalShell";
import EditorialShell from "./shells/EditorialShell";
import WarmShell from "./shells/WarmShell";
import MoodyShell from "./shells/MoodyShell";
import BoldShell from "./shells/BoldShell";
import DefaultShell from "./shells/DefaultShell";
import ExplanationOverlay from "./ExplanationOverlay";
import EmptyProfileState from "./states/EmptyProfileState";
import BrandOnlyProfileState from "./states/BrandOnlyProfileState";
import ProjectsOnlyProfileState from "./states/ProjectsOnlyProfileState";
import { ShellProps } from "./shells/DefaultShell";

const shellMap: Record<AestheticProfile["theme"], ComponentType<ShellProps>> = {
  minimal: MinimalShell,
  editorial: EditorialShell,
  warm: WarmShell,
  moody: MoodyShell,
  bold: BoldShell,
  coastal: WarmShell, // Reuse warm shell with different mosaic theme
  eclectic: DefaultShell,
  default: DefaultShell,
};

const defaultAesthetic: AestheticProfile = {
  theme: "default",
  confidence: 0,
  signals: {
    colorTemperature: "neutral",
    density: "balanced",
    contrast: "medium",
    dominantMaterials: [],
    spatialStyle: "mixed",
  },
  explanation: "",
  alternativeThemes: [],
};

export default function DesignerProfileShell(props: ProfileContext) {
  const { state, designer, projects, brandAssets, aesthetic, viewerContext, isOwner } = props;

  // Route to appropriate state component
  const renderContent = () => {
    switch (state) {
      case "empty":
        return <EmptyProfileState designer={designer} isOwner={isOwner} />;

      case "brand_only":
        if (!brandAssets) {
          // Fallback if state says brand_only but no assets
          return <EmptyProfileState designer={designer} isOwner={isOwner} />;
        }
        return (
          <BrandOnlyProfileState
            designer={designer}
            brandAssets={brandAssets}
            isOwner={isOwner}
          />
        );

      case "projects_only":
        return (
          <ProjectsOnlyProfileState
            designer={designer}
            projects={projects}
            viewerContext={viewerContext}
            isOwner={isOwner}
          />
        );

      case "ready":
        // Trigger detection (should happen server-side, but fallback here)
        return (
          <ProjectsOnlyProfileState
            designer={designer}
            projects={projects}
            viewerContext={viewerContext}
            isOwner={isOwner}
          />
        );

      case "generated":
      case "customized":
        // Full profile with detected/customized aesthetic
        if (!aesthetic) {
          return (
            <DefaultShell
              designer={designer}
              projects={projects}
              aesthetic={defaultAesthetic}
              viewerContext={viewerContext}
            />
          );
        }
        const Shell = shellMap[aesthetic.theme] || DefaultShell;
        const showExplanation = state === "generated" && aesthetic.confidence > 0.3;
        return (
          <>
            <Shell
              designer={designer}
              projects={projects}
              aesthetic={aesthetic}
              viewerContext={viewerContext}
            />
            {showExplanation && <ExplanationOverlay aesthetic={aesthetic} />}
          </>
        );

      default:
        return (
          <DefaultShell
            designer={designer}
            projects={projects}
            aesthetic={aesthetic || defaultAesthetic}
            viewerContext={viewerContext}
          />
        );
    }
  };

  return (
    <DesignerFlowErrorBoundary context="designer-profile">
      {renderContent()}
    </DesignerFlowErrorBoundary>
  );
}

