/**
 * Scene Preset Library for Product 3D Viewer
 *
 * Each preset defines a complete lighting/environment setup for
 * presenting products in the 3D hero viewer. No Three.js imports —
 * just data. The viewer component constructs the scene from these.
 */

export interface ScenePreset {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  categories: string[];
  bgGradient: [string, string, string]; // top, mid, bottom
  ground: {
    enabled: boolean;
    color: string;
    reflectivity: number; // 0-1
    roughness: number;    // 0-1
    mirror: boolean;      // true = MeshReflectorMaterial (real reflections)
  };
  lights: {
    key:     { position: [number, number, number]; color: string; intensity: number };
    fill:    { position: [number, number, number]; color: string; intensity: number };
    rim:     { position: [number, number, number]; color: string; intensity: number };
    ambient: { color: string; intensity: number };
  };
  fog: { color: string; near: number; far: number } | null;
  shadow: { opacity: number; color: string };
  environment: {
    hdriPath: string;           // local path under /assets/hdri/
    backgroundBlurriness: number; // 0 = sharp HDRI, 1 = fully blurred
    backgroundIntensity: number; // brightness of the background
    environmentIntensity: number; // IBL strength on materials
  };
  effects: {
    goboShadows: boolean;
    waterCaustics: boolean;
  };
}

export const SCENE_PRESETS: Record<string, ScenePreset> = {
  'salt-flats': {
    id: 'salt-flats',
    name: 'Salt Flats',
    subtitle: 'The Bottega Veneta',
    description: 'Infinite mirror plane reflecting a sunset sky.',
    categories: ['furniture', 'decorative', 'stone', 'lighting'],
    bgGradient: ['#c8d8e8', '#d4b0c0', '#e8c0a0'],
    ground: { enabled: true, color: '#d8d0e0', reflectivity: 0.9, roughness: 0.05, mirror: true },
    lights: {
      key:     { position: [-6, 8, 5],  color: '#ffe0c0', intensity: 0.8 },
      fill:    { position: [5, 4, 3],   color: '#e0d0e8', intensity: 0.3 },
      rim:     { position: [0, 6, -6],  color: '#ffd0b0', intensity: 0.5 },
      ambient: { color: '#e0d8e8', intensity: 0.2 },
    },
    fog: { color: '#d8c8d8', near: 15, far: 50 },
    shadow: { opacity: 0.08, color: '#8878a0' },
    environment: { hdriPath: '/assets/hdri/studio_small_03_1k.hdr', backgroundBlurriness: 0.02, backgroundIntensity: 0.9, environmentIntensity: 0.6 },
    effects: { goboShadows: false, waterCaustics: false },
  },

  'dawn-gradient': {
    id: 'dawn-gradient',
    name: 'Dawn Gradient',
    subtitle: 'The Céline',
    description: 'No ground. Warm atmospheric gradient.',
    categories: ['lighting', 'ceramics', 'glass', 'accessories'],
    bgGradient: ['#faf5ef', '#f0e0cc', '#d4a574'],
    ground: { enabled: false, color: '#f0e0cc', reflectivity: 0, roughness: 1, mirror: false },
    lights: {
      key:     { position: [-5, 7, 4],  color: '#ffe8cc', intensity: 0.8 },
      fill:    { position: [6, 3, 2],   color: '#fff5eb', intensity: 0.3 },
      rim:     { position: [1, 5, -5],  color: '#ffd4a3', intensity: 0.5 },
      ambient: { color: '#f5e6d0', intensity: 0.2 },
    },
    fog: { color: '#f0e0cc', near: 8, far: 25 },
    shadow: { opacity: 0, color: '#8b7355' },
    environment: { hdriPath: '/assets/hdri/studio_small_03_1k.hdr', backgroundBlurriness: 0.4, backgroundIntensity: 0.8, environmentIntensity: 0.7 },
    effects: { goboShadows: false, waterCaustics: false },
  },

  'concrete': {
    id: 'concrete',
    name: 'Concrete Platform',
    subtitle: 'The Aesop',
    description: 'Raw concrete slab, dramatic side light.',
    categories: ['hardware', 'fixtures', 'stone', 'metal'],
    bgGradient: ['#e8e4df', '#d5d0ca', '#b8b2a8'],
    ground: { enabled: true, color: '#c8c2b8', reflectivity: 0.05, roughness: 0.85, mirror: false },
    lights: {
      key:     { position: [-8, 5, 2],  color: '#fff0dd', intensity: 1.2 },
      fill:    { position: [4, 3, 4],   color: '#e8e4df', intensity: 0.15 },
      rim:     { position: [2, 6, -4],  color: '#ffe8d4', intensity: 0.4 },
      ambient: { color: '#e0dbd4', intensity: 0.15 },
    },
    fog: null,
    shadow: { opacity: 0.25, color: '#7a7068' },
    environment: { hdriPath: '/assets/hdri/studio_small_03_1k.hdr', backgroundBlurriness: 0.6, backgroundIntensity: 0.5, environmentIntensity: 0.4 },
    effects: { goboShadows: false, waterCaustics: false },
  },

  'linen': {
    id: 'linen',
    name: 'Linen Drape',
    subtitle: 'The Loro Piana',
    description: 'Soft fabric surface with gentle folds.',
    categories: ['textiles', 'ceramics', 'decorative', 'accessories'],
    bgGradient: ['#f8f4ef', '#efe8df', '#e5ddd0'],
    ground: { enabled: true, color: '#ece4d8', reflectivity: 0.02, roughness: 0.95, mirror: false },
    lights: {
      key:     { position: [-4, 8, 6],  color: '#fff8f0', intensity: 0.8 },
      fill:    { position: [5, 4, 3],   color: '#f8f4ef', intensity: 0.4 },
      rim:     { position: [-1, 5, -5], color: '#fff5ea', intensity: 0.3 },
      ambient: { color: '#f5f0e8', intensity: 0.3 },
    },
    fog: null,
    shadow: { opacity: 0.08, color: '#a09888' },
    environment: { hdriPath: '/assets/hdri/studio_small_03_1k.hdr', backgroundBlurriness: 0.8, backgroundIntensity: 0.6, environmentIntensity: 0.5 },
    effects: { goboShadows: false, waterCaustics: false },
  },

  'fog': {
    id: 'fog',
    name: 'Atmospheric Fog',
    subtitle: 'The Tom Ford',
    description: 'Product emerges from volumetric depth.',
    categories: ['lighting', 'glass', 'furniture', 'premium'],
    bgGradient: ['#e8e0d6', '#c8bfb2', '#a09588'],
    ground: { enabled: true, color: '#b8b0a4', reflectivity: 0.15, roughness: 0.4, mirror: false },
    lights: {
      key:     { position: [-5, 6, 5],  color: '#ffe0bb', intensity: 1.0 },
      fill:    { position: [4, 3, 2],   color: '#d8d0c5', intensity: 0.2 },
      rim:     { position: [0, 5, -4],  color: '#ffd8b0', intensity: 0.6 },
      ambient: { color: '#d0c8bc', intensity: 0.2 },
    },
    fog: { color: '#c8bfb2', near: 4, far: 15 },
    shadow: { opacity: 0.12, color: '#8a8078' },
    environment: { hdriPath: '/assets/hdri/studio_small_03_1k.hdr', backgroundBlurriness: 0.9, backgroundIntensity: 0.3, environmentIntensity: 0.4 },
    effects: { goboShadows: false, waterCaustics: false },
  },

  'water': {
    id: 'water',
    name: 'Water Surface',
    subtitle: 'The James Turrell',
    description: 'Calm water plane with subtle caustic light.',
    categories: ['bath', 'fixtures', 'stone', 'glass', 'ceramic'],
    bgGradient: ['#f0ebe4', '#e0d8cc', '#c8bfb0'],
    ground: { enabled: true, color: '#d0c8bb', reflectivity: 0.5, roughness: 0.05, mirror: true },
    lights: {
      key:     { position: [-5, 8, 5],  color: '#fff5e6', intensity: 0.8 },
      fill:    { position: [6, 2, 3],   color: '#e8e4de', intensity: 0.3 },
      rim:     { position: [0, 4, -6],  color: '#ffeedd', intensity: 0.4 },
      ambient: { color: '#ebe5dc', intensity: 0.2 },
    },
    fog: null,
    shadow: { opacity: 0.1, color: '#a09888' },
    environment: { hdriPath: '/assets/hdri/studio_small_03_1k.hdr', backgroundBlurriness: 0.5, backgroundIntensity: 0.7, environmentIntensity: 0.5 },
    effects: { goboShadows: false, waterCaustics: true },
  },

  'shadow-play': {
    id: 'shadow-play',
    name: 'Shadow Play',
    subtitle: 'The Hermès',
    description: 'Clean surface with projected architectural shadows.',
    categories: ['furniture', 'accessories', 'textiles', 'decorative'],
    bgGradient: ['#f5f0ea', '#ebe4da', '#ddd4c6'],
    ground: { enabled: true, color: '#ebe4d8', reflectivity: 0.08, roughness: 0.6, mirror: false },
    lights: {
      key:     { position: [-6, 10, 3], color: '#fff5e0', intensity: 1.2 },
      fill:    { position: [5, 3, 5],   color: '#f0ebe4', intensity: 0.2 },
      rim:     { position: [1, 5, -5],  color: '#fff0dd', intensity: 0.3 },
      ambient: { color: '#ede6dc', intensity: 0.15 },
    },
    fog: null,
    shadow: { opacity: 0.2, color: '#8a8278' },
    environment: { hdriPath: '/assets/hdri/studio_small_03_1k.hdr', backgroundBlurriness: 0.7, backgroundIntensity: 0.4, environmentIntensity: 0.4 },
    effects: { goboShadows: true, waterCaustics: false },
  },
};

export const DEFAULT_PRESET_ID = 'salt-flats';

/**
 * Auto-select the best preset for a product based on category.
 */
export function getRecommendedPreset(category?: string | null): string {
  if (!category) return DEFAULT_PRESET_ID;

  const normalized = category.toLowerCase();

  const matches = Object.values(SCENE_PRESETS).filter((p) =>
    p.categories.some((c) => normalized.includes(c) || c.includes(normalized))
  );

  return matches[0]?.id || DEFAULT_PRESET_ID;
}
