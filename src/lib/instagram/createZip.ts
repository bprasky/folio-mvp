/**
 * Create ZIP file from carousel slides and caption
 */

import JSZip from 'jszip';

interface ZipInput {
  slides: Buffer[];
  caption: string;
  projectTitle: string;
}

export async function createZip(input: ZipInput): Promise<Buffer> {
  const zip = new JSZip();

  // Add image slides (numbered 01, 02, etc.)
  input.slides.forEach((slide, index) => {
    const filename = `slide-${String(index + 1).padStart(2, '0')}.jpg`;
    zip.file(filename, slide);
  });

  // Add caption text file
  zip.file('caption.txt', input.caption);

  // Generate ZIP buffer
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return zipBuffer;
}

