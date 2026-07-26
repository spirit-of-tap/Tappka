/**
 * Image cropping utility for extracting cropped areas from images
 * Used with react-easy-crop to generate final cropped images
 */

export interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Creates a cropped image from the original image based on crop area
 * 
 * @param imageSrc - Source image URL (data URL or blob URL)
 * @param croppedAreaPixels - Crop area coordinates in pixels
 * @returns Promise resolving to a Blob of the cropped image
 */
export async function getCroppedImage(
  imageSrc: string,
  croppedAreaPixels: CroppedAreaPixels
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Set canvas to crop dimensions
  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;

  // Draw the cropped area
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from cropped image'));
        }
      },
      'image/png', // Use PNG for intermediate crop to preserve quality
      1.0
    );
  });
}

/**
 * Convert cropped blob to File for further processing
 */
export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type });
}

/**
 * Create an image element from a source URL
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
}
