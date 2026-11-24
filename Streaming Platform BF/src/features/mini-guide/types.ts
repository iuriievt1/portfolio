export type MiniGuideVariant =
  | "mobile"
  | "tablet-portrait"
  | "tablet-landscape";

export type MiniGuideProgramme = {
  description?: string | undefined;
  endsAt?: string | undefined;
  episodeNumber?: string | undefined;
  imageUrl?: string | undefined;
  seasonNumber?: string | undefined;
  startsAt: string;
  title: string;
};

export type MiniGuideChannel = {
  id: string;
  logoUrl?: string | undefined;
  name: string;
  next: MiniGuideProgramme | null;
  now: MiniGuideProgramme | null;
};
