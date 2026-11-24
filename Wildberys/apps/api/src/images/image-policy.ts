/** The rules of photo uploads in one place. */

export const maxUploadBytes = 10 * 1024 * 1024;

/** The formats a photo can be uploaded in. Every stored copy is WebP. */
export const acceptedFormats = ['jpeg', 'png', 'webp'] as const;

/** A photo with more pixels than this is refused, so a small file cannot unpack into a huge picture. */
export const maxInputPixels = 50_000_000;

/**
 * Widths of the stored copies. A copy is made for every width the photo is wide enough for,
 * and one more of the photo's own width when it is narrower than the largest. A photo is never enlarged.
 */
export const copyWidths = [320, 640, 1280, 2560] as const;
