import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { BrandAssets, AestheticTheme } from "@/lib/aesthetic/types";

type Props = {
  designer: {
    id: string;
    name: string;
    title?: string | null;
    profileImage?: string | null;
    location?: string | null;
  };
  brandAssets: BrandAssets;
  isOwner: boolean;
};

// Infer theme from brand colors/adjectives
function inferThemeFromBrand(brand: BrandAssets): AestheticTheme {
  const adjectives = brand.brandAdjectives.map((a) => a.toLowerCase());

  if (adjectives.some((a) => ["minimal", "clean", "simple", "quiet"].includes(a))) {
    return "minimal";
  }
  if (adjectives.some((a) => ["warm", "cozy", "inviting", "natural"].includes(a))) {
    return "warm";
  }
  if (adjectives.some((a) => ["bold", "dramatic", "statement", "luxe"].includes(a))) {
    return "bold";
  }
  if (adjectives.some((a) => ["moody", "dark", "atmospheric", "rich"].includes(a))) {
    return "moody";
  }
  if (adjectives.some((a) => ["editorial", "refined", "curated", "polished"].includes(a))) {
    return "editorial";
  }

  // Fall back to color temperature
  if (brand.primaryColor) {
    const temp = getColorTemperature(brand.primaryColor);
    if (temp === "warm") return "warm";
    if (temp === "cool") return "minimal";
  }

  return "default";
}

function getColorTemperature(hex: string): "warm" | "cool" | "neutral" {
  const rgb = hexToRgb(hex);
  if (!rgb) return "neutral";

  const warmth = (rgb.r * 1.0 + rgb.g * 0.5 - rgb.b * 0.5) / 255;
  if (warmth > 0.6) return "warm";
  if (warmth < 0.4) return "cool";
  return "neutral";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getContrastColor(bgColor: string | null | undefined): string {
  if (!bgColor) return "text-neutral-900";
  const rgb = hexToRgb(bgColor);
  if (!rgb) return "text-neutral-900";
  const lightness = (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255;
  return lightness > 0.5 ? "text-neutral-900" : "text-white";
}

export default function BrandOnlyProfileState({ designer, brandAssets, isOwner }: Props) {
  const preliminaryTheme = inferThemeFromBrand(brandAssets);

  if (!isOwner) {
    // Public view - show brand-styled placeholder
    return (
      <div
        className="min-h-screen"
        style={{
          backgroundColor: brandAssets.backgroundColor || "#FAFAFA",
        }}
      >
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          {brandAssets.logoLightUrl && (
            <img
              src={brandAssets.logoLightUrl}
              alt={designer.name}
              className="h-16 mx-auto mb-8"
            />
          )}
          <h1
            className="text-3xl font-semibold"
            style={{
              fontFamily: brandAssets.headingFont || "inherit",
              color: getContrastColor(brandAssets.backgroundColor) === "text-white" ? "#fff" : "#111",
            }}
          >
            {designer.name}
          </h1>
          {brandAssets.tagline && (
            <p
              className="mt-4 text-lg opacity-80"
              style={{
                color: getContrastColor(brandAssets.backgroundColor) === "text-white" ? "#fff" : "#111",
              }}
            >
              {brandAssets.tagline}
            </p>
          )}
          <p
            className="mt-8 opacity-60"
            style={{
              color: getContrastColor(brandAssets.backgroundColor) === "text-white" ? "#fff" : "#111",
            }}
          >
            Portfolio coming soon.
          </p>

          {/* Show mood images as a teaser */}
          {brandAssets.moodImageUrls.length > 0 && (
            <div className="mt-12 grid grid-cols-3 gap-2 max-w-md mx-auto">
              {brandAssets.moodImageUrls.slice(0, 3).map((url, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden">
                  <SafeImage
                    src={url}
                    alt=""
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Owner view - show preview + prompt to add projects
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Preview banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-sm text-amber-800">
            <strong>Preview mode:</strong> This is how your profile will look. Add projects to complete it.
          </p>
          <Link
            href="/designer/projects/new"
            className="px-4 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
          >
            Add First Project
          </Link>
        </div>
      </div>

      {/* Brand preview */}
      <div
        className="min-h-[60vh] flex items-center justify-center"
        style={{
          backgroundColor: brandAssets.backgroundColor || "#FAFAFA",
        }}
      >
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          {brandAssets.logoLightUrl && (
            <img
              src={brandAssets.logoLightUrl}
              alt={designer.name}
              className="h-16 mx-auto mb-8"
            />
          )}
          <h1
            className="text-3xl font-semibold"
            style={{
              fontFamily: brandAssets.headingFont || "inherit",
              color: getContrastColor(brandAssets.backgroundColor) === "text-white" ? "#fff" : "#111",
            }}
          >
            {designer.name}
          </h1>
          {brandAssets.tagline && (
            <p
              className="mt-4 text-lg opacity-80"
              style={{
                color: getContrastColor(brandAssets.backgroundColor) === "text-white" ? "#fff" : "#111",
              }}
            >
              {brandAssets.tagline}
            </p>
          )}
        </div>
      </div>

      {/* Placeholder project grid */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-xl border-2 border-dashed border-neutral-300 flex items-center justify-center bg-white"
            >
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                  <svg
                    className="w-6 h-6 text-neutral-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <p className="text-sm text-neutral-500">Add project {i}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


