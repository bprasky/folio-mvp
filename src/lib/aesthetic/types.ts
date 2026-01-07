export type AestheticTheme = 
  | "minimal" 
  | "editorial" 
  | "bold" 
  | "warm" 
  | "coastal"
  | "moody"
  | "eclectic"
  | "default";

export type ColorTemperature = "cool" | "neutral" | "warm";
export type ContrastLevel = "low" | "medium" | "high";
export type DensityLevel = "sparse" | "balanced" | "dense";

export type ImageSignals = {
  dominantColors: string[];
  colorTemperature: ColorTemperature;
  saturation: number;
  contrast: ContrastLevel;
  whitespaceRatio: number;
  textureComplexity: number;
  lightnessAvg: number;
};

export type MaterialSignals = {
  naturalMaterials: number;
  metalMaterials: number;
  syntheticMaterials: number;
  dominantMaterials: string[];
};

export type SpatialSignals = {
  roomTypes: Record<string, number>;
  avgObjectDensity: number;
  symmetryScore: number;
  architecturalEmphasis: boolean;
};

export type LanguageSignals = {
  vocabularyStyle: "technical" | "poetic" | "casual" | "formal";
  emotionalTone: "restrained" | "warm" | "dramatic" | "playful";
  keyPhrases: string[];
};

export type AestheticProfile = {
  theme: AestheticTheme;
  confidence: number;
  signals: {
    colorTemperature: ColorTemperature;
    density: DensityLevel;
    contrast: ContrastLevel;
    dominantMaterials: string[];
    spatialStyle: string;
  };
  explanation: string;
  alternativeThemes: AestheticTheme[];
};

export type DetectionInput = {
  projects: Array<{
    id: string;
    images: Array<{
      url: string;
      precomputedSignals?: ImageSignals;
      objectCount?: number;
      hasArchitecturalFeatures?: boolean;
    }>;
    productTags?: Array<{ product: { category?: string; materials?: string[] } }>;
    rooms?: Array<{ type: string; materials?: string[] }>;
    roomType?: string;
    description?: string;
  }>;
  interviews?: Array<{ transcript?: string }>;
  brandAssets?: BrandAssets | null;
};

export type ViewerFingerprint = {
  aestheticVector?: number[];
  interestedRooms?: string[];
  preferredMaterials?: string[];
};

export type BrandAssets = {
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  logomarkUrl?: string | null;
  
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  
  headingFont?: string | null;
  bodyFont?: string | null;
  
  moodImageUrls: string[];
  inspirationNotes?: string | null;
  
  inspiredByDesigners: string[];
  inspiredByPublications: string[];
  
  tagline?: string | null;
  brandAdjectives: string[];
};

export type ProfileState = 
  | "empty"
  | "brand_only"
  | "projects_only"
  | "ready"
  | "generated"
  | "customized";

export type ProfileContext = {
  state: ProfileState;
  designer: {
    id: string;
    name: string;
    title?: string | null;
    bio?: string | null;
    profileImage?: string | null;
    location?: string | null;
  };
  projects: Array<{
    id: string;
    title: string;
    imageUrl?: string | null;
    heroImageUrl?: string | null;
    coverImageUrl?: string | null;
    saveCount?: number | null;
    viewCount?: number | null;
    isFeatured?: boolean | null;
    roomType?: string | null;
    aestheticVector?: number[];
  }>;
  brandAssets?: BrandAssets | null;
  aesthetic?: AestheticProfile | null;
  viewerContext?: ViewerFingerprint | null;
  isOwner: boolean;
};

