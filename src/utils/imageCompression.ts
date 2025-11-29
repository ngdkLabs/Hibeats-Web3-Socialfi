import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  initialQuality?: number; // 0.0 to 1.0 (0.9 = 90% quality)
  alwaysKeepResolution?: boolean;
}

/**
 * Compress image file before upload
 * @param file - Original image file
 * @param options - Compression options
 * @returns Compressed image file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  // Default options - Higher quality settings
  const defaultOptions = {
    maxSizeMB: 2, // Max file size in MB (increased for better quality)
    maxWidthOrHeight: 2560, // Max width or height (increased)
    useWebWorker: true,
    fileType: file.type,
    initialQuality: 0.9, // High quality (0.9 = 90% quality)
    alwaysKeepResolution: false, // Allow resolution reduction if needed
    ...options
  };

  try {
    console.log('Original file size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    const compressedFile = await imageCompression(file, defaultOptions);
    
    console.log('Compressed file size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
    
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original file if compression fails
    return file;
  }
}

/**
 * Compress profile/avatar images (smaller size but high quality)
 */
export async function compressProfileImage(file: File): Promise<File> {
  return compressImage(file, {
    maxSizeMB: 1, // Increased from 0.5 for better quality
    maxWidthOrHeight: 1024, // Increased from 800
    initialQuality: 0.92 // Very high quality for profile pics
  });
}

/**
 * Compress cover images (album, playlist, song covers)
 * High quality for artwork display
 */
export async function compressCoverImage(file: File): Promise<File> {
  return compressImage(file, {
    maxSizeMB: 3, // Increased from 1 for better quality
    maxWidthOrHeight: 3000, // Increased from 1920 (3000x3000 is standard for album art)
    initialQuality: 0.95 // Very high quality for cover art
  });
}

/**
 * Compress banner images
 */
export async function compressBannerImage(file: File): Promise<File> {
  return compressImage(file, {
    maxSizeMB: 3, // Increased from 1.5 for better quality
    maxWidthOrHeight: 3840, // Increased from 2560 (4K support)
    initialQuality: 0.92 // High quality for banners
  });
}

/**
 * Compress post/message images
 */
export async function compressPostImage(file: File): Promise<File> {
  return compressImage(file, {
    maxSizeMB: 2, // Increased from 1 for better quality
    maxWidthOrHeight: 2560, // Increased from 1920
    initialQuality: 0.9 // High quality for posts
  });
}

/**
 * Compress image with custom quality
 * @param file - Image file to compress
 * @param quality - Quality level: 'low' | 'medium' | 'high' | 'ultra'
 */
export async function compressImageWithQuality(
  file: File,
  quality: 'low' | 'medium' | 'high' | 'ultra' = 'high'
): Promise<File> {
  const qualitySettings = {
    low: {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1280,
      initialQuality: 0.7
    },
    medium: {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      initialQuality: 0.85
    },
    high: {
      maxSizeMB: 3,
      maxWidthOrHeight: 2560,
      initialQuality: 0.92
    },
    ultra: {
      maxSizeMB: 5,
      maxWidthOrHeight: 3840,
      initialQuality: 0.98
    }
  };

  return compressImage(file, qualitySettings[quality]);
}
