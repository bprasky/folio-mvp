import OpenAI from "openai";

export type ImageGenInput = {
  prompt: string;
  width?: number;
  height?: number;
  n?: number;
  seed?: number;
  // Reference images (URLs) for models that support image-to-image
  referenceImages?: string[];
};

export type ImageGenOutput = {
  images: Array<{ buffer: Buffer; mime: string }>;
  meta: Record<string, any>;
};

export interface ImageGenProvider {
  generate(input: ImageGenInput): Promise<ImageGenOutput>;
}

// Fake provider for development/testing
class FakeProvider implements ImageGenProvider {
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
    // This is a minimal implementation - in production you'd use a proper image library
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
    // In a real implementation, you'd use a library like canvas or sharp
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

// Google Gemini/Imagen provider
// Available models:
//   - imagen-3.0-generate-002 (standard quality)
//   - imagen-3.0-fast-generate-001 (faster, cheaper)
// Set GEMINI_IMAGE_MODEL to override the default
class GeminiProvider implements ImageGenProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
    if (!this.apiKey) throw new Error("GEMINI_API_KEY or GOOGLE_AI_API_KEY missing");
    // Default to fast model for better UX; override with GEMINI_IMAGE_MODEL if needed
    this.model = process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-fast-generate-001";
    console.log(`[GeminiProvider] Using model: ${this.model}`);
  }

  async generate(input: ImageGenInput): Promise<ImageGenOutput> {
    const n = Math.min(input.n ?? 2, 4); // Imagen supports up to 4 images
    const aspectRatio = this.getAspectRatio(input.width, input.height);

    // Use the Imagen API via Generative Language API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predict?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt: input.prompt }],
        parameters: {
          sampleCount: n,
          aspectRatio: aspectRatio,
          personGeneration: "allow_adult",
          safetyFilterLevel: "block_few",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[GeminiProvider] API error:", response.status, errorText);
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // Parse the response - Imagen returns base64 encoded images
    const images: Array<{ buffer: Buffer; mime: string }> = [];

    if (result.predictions) {
      for (const prediction of result.predictions) {
        if (prediction.bytesBase64Encoded) {
          const buffer = Buffer.from(prediction.bytesBase64Encoded, "base64");
          images.push({ buffer, mime: prediction.mimeType || "image/png" });
        }
      }
    }

    if (images.length === 0) {
      console.error("[GeminiProvider] No images in response:", JSON.stringify(result).slice(0, 500));
      throw new Error("Gemini returned no images");
    }

    return {
      images,
      meta: {
        provider: "gemini",
        model: this.model,
        aspectRatio,
        count: images.length,
      },
    };
  }

  private getAspectRatio(width?: number, height?: number): string {
    const w = width ?? 1024;
    const h = height ?? 1024;
    const ratio = w / h;

    // Imagen 3 supports: 1:1, 3:4, 4:3, 9:16, 16:9
    if (ratio > 1.7) return "16:9";      // Wide landscape
    if (ratio > 1.2) return "4:3";       // Landscape
    if (ratio < 0.6) return "9:16";      // Tall portrait
    if (ratio < 0.85) return "3:4";      // Portrait
    return "1:1";                         // Square
  }
}

// OpenAI provider using gpt-image-1
class OpenAIProvider implements ImageGenProvider {
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

// Stability AI provider
class StabilityProvider implements ImageGenProvider {
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
    // If single image: return one. If multi-part, parse boundary (left as future enhancement).
    const buffer = Buffer.from(arrayBuf);
    return { images: [{ buffer, mime: "image/png" }], meta: { provider: "stability", engine: this.engine } };
  }
}

// Replicate provider - supports Flux models with image inputs
// Flux 1.1 Pro supports up to 4 reference images, Kontext supports more
class ReplicateProvider implements ImageGenProvider {
  private apiToken: string;
  private model: string;

  constructor() {
    this.apiToken = process.env.REPLICATE_API_TOKEN || "";
    if (!this.apiToken) throw new Error("REPLICATE_API_TOKEN missing");
    // Default to flux-kontext-pro for multi-image support
    // Options: black-forest-labs/flux-1.1-pro, black-forest-labs/flux-kontext-pro
    this.model = process.env.REPLICATE_MODEL || "black-forest-labs/flux-kontext-pro";
    console.log(`[ReplicateProvider] Using model: ${this.model}`);
  }

  async generate(input: ImageGenInput): Promise<ImageGenOutput> {
    const width = input.width ?? 1024;
    const height = input.height ?? 1024;
    const n = input.n ?? 1; // Replicate typically generates one at a time

    // Build the input based on whether we have reference images
    const modelInput: Record<string, any> = {
      prompt: input.prompt,
      width,
      height,
      output_format: "png",
    };

    // Add reference images if provided (Flux Kontext supports up to 10)
    if (input.referenceImages && input.referenceImages.length > 0) {
      // Flux Kontext uses 'input_images' for multiple references
      if (this.model.includes("kontext")) {
        modelInput.input_images = input.referenceImages.slice(0, 10);
        console.log(`[ReplicateProvider] Using ${modelInput.input_images.length} reference images`);
      } else {
        // Standard Flux uses 'image' for single reference
        modelInput.image = input.referenceImages[0];
        console.log(`[ReplicateProvider] Using 1 reference image`);
      }
    }

    if (input.seed) {
      modelInput.seed = input.seed;
    }

    // Create prediction
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        "Prefer": "wait", // Wait for result instead of polling
      },
      body: JSON.stringify({
        model: this.model,
        input: modelInput,
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error("[ReplicateProvider] Create prediction error:", createRes.status, errorText);
      throw new Error(`Replicate API error ${createRes.status}: ${errorText}`);
    }

    let prediction = await createRes.json();

    // If not completed, poll for result
    if (prediction.status !== "succeeded") {
      prediction = await this.pollForResult(prediction.id);
    }

    if (prediction.status === "failed") {
      console.error("[ReplicateProvider] Prediction failed:", prediction.error);
      throw new Error(`Replicate prediction failed: ${prediction.error}`);
    }

    // Download the output image(s)
    const images: Array<{ buffer: Buffer; mime: string }> = [];
    const outputs = Array.isArray(prediction.output) ? prediction.output : [prediction.output];

    for (const outputUrl of outputs) {
      if (!outputUrl) continue;

      const imgRes = await fetch(outputUrl);
      if (!imgRes.ok) {
        console.warn(`[ReplicateProvider] Failed to fetch output image: ${outputUrl}`);
        continue;
      }

      const buffer = Buffer.from(await imgRes.arrayBuffer());
      images.push({ buffer, mime: "image/png" });
    }

    if (images.length === 0) {
      console.error("[ReplicateProvider] No images in output:", JSON.stringify(prediction).slice(0, 500));
      throw new Error("Replicate returned no images");
    }

    return {
      images,
      meta: {
        provider: "replicate",
        model: this.model,
        predictionId: prediction.id,
        referenceImagesUsed: input.referenceImages?.length ?? 0,
      },
    };
  }

  private async pollForResult(predictionId: string, maxAttempts = 60): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

      const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { "Authorization": `Bearer ${this.apiToken}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to poll prediction: ${res.status}`);
      }

      const prediction = await res.json();

      if (prediction.status === "succeeded" || prediction.status === "failed") {
        return prediction;
      }

      console.log(`[ReplicateProvider] Polling... status: ${prediction.status}`);
    }

    throw new Error("Replicate prediction timed out");
  }
}

export function getImageGenProvider(): ImageGenProvider {
  const p = (process.env.IMAGE_GEN_PROVIDER || "replicate").toLowerCase();

  // Only use fake provider if explicitly requested
  if (p === "fake" || process.env.FAKE_PROVIDER === '1') {
    console.warn('[imageGen] Using FAKE provider - images will be placeholders');
    return new FakeProvider();
  }

  if (p === "replicate" || p === "flux") {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN environment variable is not set. Image generation requires a valid API token.");
    }
    return new ReplicateProvider();
  }

  if (p === "gemini" || p === "google" || p === "imagen") {
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
      throw new Error("GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable is not set. Image generation requires a valid API key.");
    }
    return new GeminiProvider();
  }

  if (p === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set. Image generation requires a valid API key.");
    }
    return new OpenAIProvider();
  }

  if (p === "stability") {
    if (!process.env.STABILITY_API_KEY) {
      throw new Error("STABILITY_API_KEY environment variable is not set. Image generation requires a valid API key.");
    }
    return new StabilityProvider();
  }

  // No fallback - fail with clear error
  throw new Error(
    `Unknown image generation provider: "${p}". ` +
    `Valid options: replicate, gemini, openai, stability. ` +
    `Set IMAGE_GEN_PROVIDER env var to one of these values and ensure the corresponding API key/token is set.`
  );
}
