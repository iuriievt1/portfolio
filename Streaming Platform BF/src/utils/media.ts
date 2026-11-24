import type { ContentThumbnailDisplay, MediaImage } from "@bfbs/common-sdk";

const CHANNEL_LOGO_TYPE_PRIORITIES = ["logo", "channel"];
const PROGRAMME_IMAGE_ASPECT_RATIO = 16 / 9;
// Neutral first; Dark is the backup.
const TITLE_ART_TYPES = ["titletreatmentneutral", "titletreatmentdark"];

type RailThumbnailContentFit = "contain" | "cover";

export type RailThumbnail = {
  contentFit: RailThumbnailContentFit;
  url: string;
};

const THUMBNAIL_RULES: Record<
  ContentThumbnailDisplay,
  {
    avoidImageTypes?: string[];
    contentFit: RailThumbnailContentFit;
    imageTypes: string[];
  }
> = {
  CHANNEL_LOGO: {
    avoidImageTypes: ["inverted"],
    contentFit: "contain",
    imageTypes: ["regular", "channellogo", "logo", "channel"],
  },
  CHANNEL_LOGO_INVERTED: {
    contentFit: "contain",
    imageTypes: ["channellogoinverted", "inverted"],
  },
  CHANNEL_POSTER: {
    contentFit: "cover",
    imageTypes: ["channelposter", "poster"],
  },
  EVENT_POSTER: {
    contentFit: "cover",
    imageTypes: ["eventposter", "poster"],
  },
  EVENT_POSTER_WITH_TITLE: {
    contentFit: "cover",
    imageTypes: ["eventposterwithtitle", "eventposter", "poster"],
  },
};

function normaliseImageType(type: string | undefined) {
  return type?.toLowerCase().replace(/[^a-z]/gu, "") ?? "";
}

/** Upgrades plain http URLs, which iOS App Transport Security blocks. */
export function forceHttpsUrl(url: string) {
  return url.replace(/^http:\/\//i, "https://");
}

/** The image closest to 16:9, the shape of every programme image box. */
export function pickProgrammeImageUrl(
  media: readonly MediaImage[] | undefined,
) {
  return pickImageUrlForAspectRatio(media, PROGRAMME_IMAGE_ASPECT_RATIO);
}

/** The image closest in shape to the tile, so `cover` crops as little as possible. */
export function pickImageUrlForAspectRatio(
  media: readonly MediaImage[] | undefined,
  aspectRatio: number,
) {
  let bestUrl: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestArea = 0;
  // Title art is the title's logo, not artwork.
  const artwork = media?.filter(
    ({ type }) => !TITLE_ART_TYPES.includes(normaliseImageType(type)),
  );

  for (const { height, url, width } of artwork ?? []) {
    if (!(url && width && height)) {
      continue;
    }

    const distance = Math.abs(width / height - aspectRatio);
    const area = width * height;

    // On a tie, the larger image stays sharp.
    if (
      distance < bestDistance ||
      (distance === bestDistance && area > bestArea)
    ) {
      bestUrl = url;
      bestDistance = distance;
      bestArea = area;
    }
  }

  // No image has a size, so use the first one.
  const url = bestUrl ?? artwork?.find((image) => Boolean(image.url))?.url;

  return url ? forceHttpsUrl(url) : undefined;
}

export function pickChannelLogoUrl(media: MediaImage[] | undefined) {
  const usableMedia = media?.filter((image) => Boolean(image.url));

  if (!usableMedia?.length) {
    return undefined;
  }

  const prioritizedImage = CHANNEL_LOGO_TYPE_PRIORITIES.flatMap((priority) =>
    usableMedia.filter((image) => image.type?.toLowerCase().includes(priority)),
  )[0];
  const url = (prioritizedImage ?? usableMedia[0])?.url;

  return url ? forceHttpsUrl(url) : undefined;
}

/** The item's title art image and its shape, if GO sends one. */
export function pickTitleArt(media: readonly MediaImage[] | undefined) {
  for (const titleArtType of TITLE_ART_TYPES) {
    const image = media?.find(
      ({ type, url }) => url && normaliseImageType(type) === titleArtType,
    );

    if (image) {
      const { height, url, width } = image;

      return {
        aspectRatio: width && height ? width / height : undefined,
        url: forceHttpsUrl(url),
      };
    }
  }

  return undefined;
}

function pickConfiguredThumbnail(
  media: readonly MediaImage[] | undefined,
  thumbnailDisplay: ContentThumbnailDisplay | undefined,
): RailThumbnail | undefined {
  if (!thumbnailDisplay) {
    return undefined;
  }

  const rule = THUMBNAIL_RULES[thumbnailDisplay];
  const match = media?.find((image) => {
    if (!image.url) {
      return false;
    }

    const type = normaliseImageType(image.type);

    if (rule.avoidImageTypes?.some((imageType) => type.includes(imageType))) {
      return false;
    }

    return rule.imageTypes.some((imageType) => type.includes(imageType));
  });

  return match?.url
    ? { contentFit: rule.contentFit, url: forceHttpsUrl(match.url) }
    : undefined;
}

/** Resolves the requested rail image, preferring placement media over catalogue fallback media. */
export function resolveRailThumbnail({
  aspectRatio,
  fallbackMedia,
  media,
  thumbnailDisplay,
}: {
  aspectRatio: number;
  fallbackMedia?: readonly MediaImage[] | undefined;
  media?: readonly MediaImage[] | undefined;
  thumbnailDisplay?: ContentThumbnailDisplay | undefined;
}): RailThumbnail | undefined {
  if (thumbnailDisplay) {
    return (
      pickConfiguredThumbnail(media, thumbnailDisplay) ??
      pickConfiguredThumbnail(fallbackMedia, thumbnailDisplay)
    );
  }

  const url =
    pickImageUrlForAspectRatio(media, aspectRatio) ??
    pickImageUrlForAspectRatio(fallbackMedia, aspectRatio);

  return url ? { contentFit: "cover", url } : undefined;
}
