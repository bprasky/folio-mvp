import OpenAI from "openai";

export type ImageGenInput = { 
  prompt: string; 
  width?: number; 
  height?: number; 
  n?: number; 
  seed?: number; 
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

export function getImageGenProvider(): ImageGenProvider {
  const p = (process.env.IMAGE_GEN_PROVIDER || "openai").toLowerCase();
  
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
  
  if (p === "fake" || process.env.FAKE_PROVIDER === '1') {
    return new FakeProvider();
  }
  
  // Default to OpenAI
  console.warn(`Unknown image generation provider: ${p}, defaulting to OpenAI`);
  try {
    return new OpenAIProvider();
  } catch (error) {
    console.warn('OpenAI provider failed, falling back to fake provider:', error);
    return new FakeProvider();
  }
}
