/**
 * Client-side image optimization utilities
 * Resizes and converts images to WebP format for profile pictures
 */

export interface OptimizationOptions {
  targetSize: number; // Target width/height in pixels (square output)
  quality: number; // WebP quality (0-1)
  format: 'image/webp' | 'image/jpeg';
}

export const DEFAULT_OPTIMIZATION: OptimizationOptions = {
  targetSize: 512,
  quality: 0.85,
  format: 'image/webp',
};

/**
 * Optimize an image file for profile pictures
 * - Resizes to square (crops to center if not square)
 * - Converts to WebP format
 * - Compresses to target quality
 * 
 * @param file - Original image file
 * @param options - Optimization options
 * @returns Optimized image as File object
 */
export async function optimizeImage(
  file: File,
  options: OptimizationOptions = DEFAULT_OPTIMIZATION
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Clean up object URL
        URL.revokeObjectURL(objectUrl);

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Set canvas to target size
        canvas.width = options.targetSize;
        canvas.height = options.targetSize;

        // Calculate dimensions to crop to square (center crop)
        const sourceSize = Math.min(img.width, img.height);
        const sourceX = (img.width - sourceSize) / 2;
        const sourceY = (img.height - sourceSize) / 2;

        // Draw image on canvas (resized and cropped)
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          0,
          0,
          options.targetSize,
          options.targetSize
        );

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to convert image to blob'));
              return;
            }

            // Create file from blob
            const optimizedFile = new File(
              [blob],
              `profile-picture.${options.format === 'image/webp' ? 'webp' : 'jpg'}`,
              { type: options.format }
            );

            resolve(optimizedFile);
          },
          options.format,
          options.quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

/**
 * Check if browser supports WebP format
 */
export function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
