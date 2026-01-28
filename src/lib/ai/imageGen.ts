import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============ RENDER SETTINGS ============

export interface RenderSettings {
  timeOfDay: 'golden_hour_morning' | 'midday' | 'golden_hour_evening' | 'twilight' | 'night';
  lightingMood: 'bright_airy' | 'moody_dramatic' | 'warm_cozy' | 'cool_minimal';
  cameraAngle: 'eye_level' | 'elevated' | 'low_angle';
}

// ============ INPUT/OUTPUT TYPES ============

export type ImageGenInput = {
  prompt: string;
  width?: number;
  height?: number;
  n?: number;
  seed?: number;
  negativePrompt?: string;
  settings?: RenderSettings;
};

export type ImageGenOutput = {
  images: Array<{ buffer: Buffer; mime: string }>;
  meta: Record<string, any>;
};

export interface ImageGenProvider {
  name: string;
  generate(input: ImageGenInput): Promise<ImageGenOutput>;
}

// ============ CONSTANTS ============

const DEFAULT_NEGATIVE_PROMPT = `blurry, low quality, distorted, watermark, text, signature, unrealistic proportions, cartoon, anime, illustration, oversaturated colors, harsh lighting, overexposed, underexposed, people, humans, figures, hands, faces`;

// ============ FAKE PROVIDER ============

class FakeProvider implements ImageGenProvider {
  name = 'fake';

  async generate(input: ImageGenInput): Promise<ImageGenOutput> {
    const { prompt, width = 1024, height = 1024, n = 2 } = input;

    // Create a simple placeholder image with prompt text
    const images = Array.from({ length: n }, (_, i) => {
      const buffer = this.createPlaceholderImage(prompt, width, height, i + 1);
      return { buffer, mime: 'image/png' };
    });

    return {
      images,
      meta: {
        provider: 'fake',
        prompt,
        width,
        height,
        count: n,
        seed: input.seed || Math.floor(Math.random() * 1000000)
      }
    };
  }

  private createPlaceholderImage(prompt: string, width: number, height: number, index: number): Buffer {
    // Create a simple PNG buffer with prompt text
    const canvas = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };

    // Fill with a subtle gradient background
    for (let i = 0; i < canvas.data.length; i += 4) {
      const pixel = i / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);

      // Create a subtle gradient
      const intensity = Math.floor(240 + (Math.sin(x / 100) * 10) + (Math.cos(y / 100) * 10));

      canvas.data[i] = intensity;     // R
      canvas.data[i + 1] = intensity; // G
      canvas.data[i + 2] = intensity; // B
      canvas.data[i + 3] = 255;       // A
    }

    // For now, return a minimal PNG header + data
    const header = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    ]);

    // Create a simple 1x1 pixel PNG as placeholder
    const pngData = Buffer.concat([
      header,
      Buffer.from(`Generated Image ${index}\nPrompt: ${prompt.substring(0, 100)}...`, 'utf8')
    ]);

    return pngData;
  }
}

// ============ OPENAI PROVIDER ============

class OpenAIProvider implements ImageGenProvider {
  name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY missing");
    this.client = new OpenAI({ apiKey: key });
    this.model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  }

  private mapSize(width?: number, height?: number) {
    const w = width ?? 1024;
    const h = height ?? 1024;
    // Supported presets for gpt-image-1 (square & two rectangles)
    if (w === 1024 && h === 1024) return "1024x1024";
    if ((w >= 1400 && h <= 1100) || (w === 1536 && h === 1024)) return "1536x1024";
    if ((h >= 1400 && w <= 1100) || (w === 1024 && h === 1536)) return "1024x1536";
    // Fallback to square if unknown combo
    return "1024x1024";
  }

  async generate(input: ImageGenInput): Promise<ImageGenOutput> {
    const n = input.n ?? 2;
    const size = this.mapSize(input.width, input.height);

    // DO NOT pass response_format; SDK returns b64_json by default
    const res = await this.client.images.generate({
      model: this.model,
      prompt: input.prompt ?? "",
      n,
      size,
    });

    const images = (res.data ?? []).map((d: any) => {
      const b64 = d.b64_json as string;
      const buffer = Buffer.from(b64, "base64");
      return { buffer, mime: "image/png" as const };
    });

    return { images, meta: { provider: "openai", size } };
  }
}

// ============ STABILITY PROVIDER ============

class StabilityProvider implements ImageGenProvider {
  name = 'stability';
  private apiKey: string;
  private engine: string;

  constructor() {
    this.apiKey = process.env.STABILITY_API_KEY || "";
    this.engine = process.env.STABILITY_ENGINE || "stable-image-ultra";
    if (!this.apiKey) throw new Error("STABILITY_API_KEY missing");
  }

  async generate(input: ImageGenInput): Promise<ImageGenOutput> {
    const n = input.n ?? 2;
    const width = input.width ?? 1024;
    const height = input.height ?? 1024;

    const url = `https://api.stability.ai/v2beta/stable-image/generate/${this.engine}`;
    const form = new FormData();
    form.set("prompt", input.prompt || "");
    form.set("output_format", "png");
    form.set("width", String(width));
    form.set("height", String(height));
    form.set("samples", String(n));

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stability error ${res.status}: ${text}`);
    }

    // Stability may return a multipart; many endpoints return a single image body.
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    return { images: [{ buffer, mime: "image/png" }], meta: { provider: "stability", engine: this.engine } };
  }
}

// ============ GEMINI PROVIDER (Imagen 3) ============

class GeminiProvider implements ImageGenProvider {
  name = 'gemini';
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY missing");
    this.genAI = new GoogleGenerativeAI(key);
    this.modelName = process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-002";
  }

  private getAspectRatio(width: number, height: number): string {
    const ratio = width / height;
    // Gemini Imagen 3 supported aspect ratios
    if (Math.abs(ratio - 1) < 0.1) return '1:1';
    if (Math.abs(ratio - 16/9) < 0.15) return '16:9';
    if (Math.abs(ratio - 9/16) < 0.15) return '9:16';
    if (Math.abs(ratio - 4/3) < 0.15) return '4:3';
    if (Math.abs(ratio - 3/4) < 0.15) return '3:4';
    // Default to closest based on ratio
    return ratio > 1 ? '16:9' : '9:16';
  }

  async generate(input: ImageGenInput): Promise<ImageGenOutput> {
    const n = input.n ?? 2;
    const width = input.width ?? 1024;
    const height = input.height ?? 1024;
    const aspectRatio = this.getAspectRatio(width, height);
    const negativePrompt = input.negativePrompt || DEFAULT_NEGATIVE_PROMPT;

    // Use the Gemini API for image generation
    // Note: The exact API may vary based on Google's SDK version
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });

      // Build the full prompt with negative prompt guidance
      const fullPrompt = `${input.prompt}\n\nAvoid: ${negativePrompt}`;

      // Generate images one at a time (Imagen API limitation)
      const images: Array<{ buffer: Buffer; mime: string }> = [];

      for (let i = 0; i < n; i++) {
        // Use generateContent with image generation capabilities
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{
              text: `Generate a photorealistic interior design image with aspect ratio ${aspectRatio}.\n\n${fullPrompt}`
            }]
          }],
          generationConfig: {
            // @ts-ignore - Image generation config
            responseModality: 'image',
          }
        });

        const response = result.response;

        // Extract image data from response
        if (response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              const buffer = Buffer.from(part.inlineData.data, 'base64');
              images.push({ buffer, mime: part.inlineData.mimeType || 'image/png' });
            }
          }
        }
      }

      if (images.length === 0) {
        throw new Error('Gemini returned no images');
      }

      return {
        images,
        meta: {
          provider: 'gemini',
          model: this.modelName,
          aspectRatio,
          count: images.length,
        }
      };
    } catch (error: any) {
      console.error('[GeminiProvider] Generation error:', error);
      throw new Error(`Gemini image generation failed: ${error.message}`);
    }
  }
}

// ============ PROVIDER FACTORY ============

export function getImageGenProvider(): ImageGenProvider {
  // Override to fake if explicitly set
  if (process.env.FAKE_PROVIDER === '1') {
    return new FakeProvider();
  }

  const p = (process.env.IMAGE_GEN_PROVIDER || "gemini").toLowerCase();

  if (p === "gemini") {
    try {
      return new GeminiProvider();
    } catch (error) {
      console.warn('Gemini provider failed to initialize, falling back to fake provider:', error);
      return new FakeProvider();
    }
  }

  if (p === "openai") {
    try {
      return new OpenAIProvider();
    } catch (error) {
      console.warn('OpenAI provider failed to initialize, falling back to fake provider:', error);
      return new FakeProvider();
    }
  }

  if (p === "stability") {
    try {
      return new StabilityProvider();
    } catch (error) {
      console.warn('Stability provider failed to initialize, falling back to fake provider:', error);
      return new FakeProvider();
    }
  }

  if (p === "fake") {
    return new FakeProvider();
  }

  // Default to Gemini
  console.warn(`Unknown image generation provider: ${p}, defaulting to Gemini`);
  try {
    return new GeminiProvider();
  } catch (error) {
    console.warn('Gemini provider failed, falling back to fake provider:', error);
    return new FakeProvider();
  }
}
