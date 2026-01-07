import OpenAI from "openai";

// Initialize OpenAI client
const client = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Generate an embedding vector for the given text using OpenAI's text-embedding-3-large model
 * 
 * @param text - The text to embed (will be truncated to 8000 chars)
 * @returns Array of floats representing the embedding vector
 */
export async function embedText(text: string): Promise<number[]> {
  try {
    const res = await client.embeddings.create({
      model: "text-embedding-3-large",
      input: text.slice(0, 8000),
    });
    return res.data[0].embedding;
  } catch (error) {
    console.error("[Embeddings] Failed to generate embedding:", error);
    throw error;
  }
}

/**
 * Convert a number array to a Buffer for storage in PostgreSQL
 * 
 * @param vector - The embedding vector as an array of numbers
 * @returns Buffer containing the Float32Array data
 */
export function vectorToBuffer(vector: number[]): Buffer {
  return Buffer.from(Float32Array.from(vector).buffer);
}

/**
 * Convert a Buffer back to a number array
 * 
 * @param buffer - The Buffer containing Float32Array data
 * @returns Array of numbers representing the embedding
 */
export function bufferToVector(buffer: Buffer): number[] {
  const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
  return Array.from(float32Array);
}

/**
 * Build a descriptive text string for embedding generation
 * Combines name, description, and tags into a single searchable string
 */
export function buildEmbeddingText(source: {
  name?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  tags?: string[];
  materials?: string[];
  eventTypes?: string[];
  designStyles?: string[];
}): string {
  const parts: string[] = [];
  
  if (source.name) parts.push(source.name);
  if (source.title) parts.push(source.title);
  if (source.description) parts.push(source.description);
  if (source.category) parts.push(`Category: ${source.category}`);
  if (source.brand) parts.push(`Brand: ${source.brand}`);
  if (source.tags?.length) parts.push(`Tags: ${source.tags.join(", ")}`);
  if (source.materials?.length) parts.push(`Materials: ${source.materials.join(", ")}`);
  if (source.eventTypes?.length) parts.push(`Event Types: ${source.eventTypes.join(", ")}`);
  if (source.designStyles?.length) parts.push(`Design Styles: ${source.designStyles.join(", ")}`);
  
  return parts.join(". ");
}




