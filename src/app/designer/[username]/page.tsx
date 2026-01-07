import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { getDesignerPublishedProjects } from "@/server/queries/getDesignerProjectsWithProducts";
import { detectAesthetic, AestheticProfile, BrandAssets } from "@/lib/aesthetic";
import { getProfileState } from "@/lib/profile/getProfileState";
import DesignerProfileShell from "@/components/profile/DesignerProfileShell";

/**
 * Get viewer fingerprint for personalization
 * Currently stubbed - can be enhanced with actual user preference data
 */
async function getViewerFingerprint(userId: string | null): Promise<{
  aestheticVector?: number[];
  interestedRooms?: string[];
  preferredMaterials?: string[];
} | null> {
  if (!userId) return null;
  
  // TODO: Build actual fingerprint from user's saved projects, viewed projects, etc.
  // For now, return null (no personalization)
  return null;
}

/**
 * Designer Profile Page with Aesthetic Detection
 * 
 * Route: /designer/[username]
 * Currently uses id (username field not yet in schema)
 */
export default async function DesignerProfilePage({
  params,
}: {
  params: { username: string };
}) {
  // For now, treat username as id (can be updated when username field is added)
  const designerId = params.username;

  // Fetch designer with brand assets
  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    select: {
      id: true,
      name: true,
      title: true,
      bio: true,
      profileImage: true,
      location: true,
      aestheticProfile: true,
      aestheticDetectedAt: true,
      profileState: true,
      brandAssets: {
        select: {
          logoLightUrl: true,
          logoDarkUrl: true,
          logomarkUrl: true,
          primaryColor: true,
          secondaryColor: true,
          accentColor: true,
          backgroundColor: true,
          headingFont: true,
          bodyFont: true,
          moodImageUrls: true,
          inspirationNotes: true,
          inspiredByDesigners: true,
          inspiredByPublications: true,
          tagline: true,
          brandAdjectives: true,
        },
      },
    },
  });

  if (!designer) {
    notFound();
  }

  // Fetch published projects
  const projects = await getDesignerPublishedProjects(designerId);

  // Get brand assets
  const brandAssets: BrandAssets | null = designer.brandAssets
    ? {
        logoLightUrl: designer.brandAssets.logoLightUrl,
        logoDarkUrl: designer.brandAssets.logoDarkUrl,
        logomarkUrl: designer.brandAssets.logomarkUrl,
        primaryColor: designer.brandAssets.primaryColor,
        secondaryColor: designer.brandAssets.secondaryColor,
        accentColor: designer.brandAssets.accentColor,
        backgroundColor: designer.brandAssets.backgroundColor,
        headingFont: designer.brandAssets.headingFont,
        bodyFont: designer.brandAssets.bodyFont,
        moodImageUrls: designer.brandAssets.moodImageUrls,
        inspirationNotes: designer.brandAssets.inspirationNotes,
        inspiredByDesigners: designer.brandAssets.inspiredByDesigners,
        inspiredByPublications: designer.brandAssets.inspiredByPublications,
        tagline: designer.brandAssets.tagline,
        brandAdjectives: designer.brandAssets.brandAdjectives,
      }
    : null;

  // Determine profile state
  const hasBrandAssets = !!brandAssets;
  const hasAestheticProfile = !!designer.aestheticProfile;
  const isCustomized = designer.profileState === "customized";
  const state = getProfileState(
    projects.length,
    hasBrandAssets,
    hasAestheticProfile,
    isCustomized
  );

  // Get or detect aesthetic
  let aesthetic: AestheticProfile | null = null;
  const storedProfile = designer.aestheticProfile as AestheticProfile | null;

  if (storedProfile && storedProfile.theme !== "default") {
    aesthetic = storedProfile;
  } else if (projects.length >= 2 || (projects.length >= 1 && hasBrandAssets)) {
    // Run detection if we have enough projects
    try {
      // Transform projects to DetectionInput format
      const projectIds = projects.map((p) => p.id);
      
      // Fetch full project data with images, rooms, product tags
      const fullProjects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        include: {
          images: {
            select: {
              id: true,
              url: true,
              imageSignals: true,
            },
          },
          rooms: {
            select: {
              type: true,
            },
          },
        },
      });

      // Fetch product tags
      const productTags = await prisma.productTag.findMany({
        where: {
          image: {
            projectId: { in: projectIds },
          },
        },
        include: {
          product: {
            select: {
              category: true,
            },
          },
          image: {
            select: {
              id: true,
              projectId: true,
            },
          },
        },
      });

      // Fetch interviews
      const interviews = await prisma.editorialInterview.findMany({
        where: {
          projectId: { in: projectIds },
          status: "COMPLETED",
        },
        include: {
          answers: {
            select: {
              answerText: true,
            },
          },
        },
      });

      const detectionInput = {
        projects: fullProjects.map((project) => ({
          id: project.id,
          images: project.images.map((img) => ({
            url: img.url,
            precomputedSignals: img.imageSignals as any,
          })),
          productTags: productTags
            .filter((tag) => tag.image.projectId === project.id)
            .map((tag) => ({
              product: {
                category: tag.product.category || undefined,
                materials: [], // TODO: Extract from product if available
              },
            })),
          rooms: project.rooms.map((room) => ({
            type: room.type || "",
            materials: [],
          })),
          description: project.description || undefined,
        })),
        interviews: interviews.map((interview) => ({
          transcript: interview.answers.map((a) => a.answerText).join(" "),
        })),
        brandAssets: brandAssets,
      };

      aesthetic = await detectAesthetic(detectionInput);

      // Save to database (async, don't block render)
      prisma.user
        .update({
          where: { id: designerId },
          data: {
            aestheticProfile: aesthetic as any,
            aestheticDetectedAt: new Date(),
          },
        })
        .catch((error) => {
          console.error("[DesignerProfilePage] Failed to save aesthetic:", error);
        });
    } catch (error) {
      console.error("[DesignerProfilePage] Detection failed:", error);
      // Fallback to default
      aesthetic = {
        theme: "default",
        confidence: 0,
        signals: {
          colorTemperature: "neutral",
          density: "balanced",
          contrast: "medium",
          dominantMaterials: [],
          spatialStyle: "mixed",
        },
        explanation: "Unable to detect aesthetic at this time.",
        alternativeThemes: [],
      };
    }
  } else {
    // Not enough projects - use default
    aesthetic = {
      theme: "default",
      confidence: 0,
      signals: {
        colorTemperature: "neutral",
        density: "balanced",
        contrast: "medium",
        dominantMaterials: [],
        spatialStyle: "mixed",
      },
      explanation:
        projects.length === 0
          ? "No published projects yet. Upload and publish at least 2 projects to see your personalized aesthetic profile."
          : "Upload and publish at least 2 projects to see your personalized aesthetic profile.",
      alternativeThemes: [],
    };
  }

  // Get viewer context if logged in
  const session = await getServerSession(authOptions);
  const viewerContext = await getViewerFingerprint(session?.user?.id || null);
  const isOwner = session?.user?.id === designerId;

  // Transform projects to UI format
  const uiProjects = projects.map((project) => ({
    id: project.id,
    title: project.title || "Untitled Project",
    imageUrl: project.images[0]?.url || null,
    heroImageUrl: project.images[0]?.url || null,
    coverImageUrl: project.images[0]?.url || null,
    saveCount: null, // TODO: Add saves count if available
    viewCount: project.views || null,
    isFeatured: false, // TODO: Add featured flag if available
    roomType: null, // TODO: Extract from rooms if available
    aestheticVector: undefined, // TODO: Compute from project signals
  }));

  // Update profile state in database if it changed
  if (designer.profileState !== state) {
    prisma.user
      .update({
        where: { id: designerId },
        data: { profileState: state },
      })
      .catch((error) => {
        console.error("[DesignerProfilePage] Failed to update profile state:", error);
      });
  }

  return (
    <DesignerProfileShell
      state={state}
      designer={{
        id: designer.id,
        name: designer.name,
        title: designer.title || null,
        bio: designer.bio || null,
        profileImage: designer.profileImage || null,
        location: designer.location || null,
      }}
      projects={uiProjects}
      brandAssets={brandAssets}
      aesthetic={aesthetic}
      viewerContext={viewerContext}
      isOwner={isOwner}
    />
  );
}

