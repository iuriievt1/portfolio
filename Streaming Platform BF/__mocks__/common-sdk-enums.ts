export const AppState = {
  BACKGROUND: "BACKGROUND",
  FOREGROUND: "FOREGROUND",
};

export const ActionLogonResult = {
  LOGON_FAIL: "LOGON_FAIL",
  LOGON_SUCCESS: "LOGON_SUCCESS",
  LOGOUT_SUCCESS: "LOGOUT_SUCCESS",
} as const;

export const ContentCategoryTemplate = {
  HERO: "HERO",
  NINE_BY_SIXTEEN_LARGE: "NINE_BY_SIXTEEN_LARGE",
  NINE_BY_SIXTEEN_STANDARD: "NINE_BY_SIXTEEN_STANDARD",
  SIXTEEN_BY_NINE_DESIGNED_LARGE: "SIXTEEN_BY_NINE_DESIGNED_LARGE",
  SIXTEEN_BY_NINE_DESIGNED_SMALL: "SIXTEEN_BY_NINE_DESIGNED_SMALL",
  SIXTEEN_BY_NINE_LARGE: "SIXTEEN_BY_NINE_LARGE",
  SIXTEEN_BY_NINE_STANDARD: "SIXTEEN_BY_NINE_STANDARD",
  SQUARE_LARGE: "SQUARE_LARGE",
  SQUARE_SMALL: "SQUARE_SMALL",
} as const;

export const EventType = {
  ACTION_LOGON: "ACTION_LOGON",
  ACTION_SCREEN_CHANGE: "ACTION_SCREEN_CHANGE",
  APP_DISCOVERY: "APP_DISCOVERY",
  APP_START: "APP_START",
  APP_STATE_CHANGE: "APP_STATE_CHANGE",
  NETWORK_CHANGE: "NETWORK_CHANGE",
} as const;

export const ActionScreenEventType = {
  DISMISSED: "DISMISSED",
  LOADED: "LOADED",
} as const;

export const ContentThumbnailDisplay = {
  CHANNEL_LOGO: "CHANNEL_LOGO",
  CHANNEL_LOGO_INVERTED: "CHANNEL_LOGO_INVERTED",
  CHANNEL_POSTER: "CHANNEL_POSTER",
  EVENT_POSTER: "EVENT_POSTER",
  EVENT_POSTER_WITH_TITLE: "EVENT_POSTER_WITH_TITLE",
} as const;

export const DeviceClass = {
  MOBILE: "Mobile",
} as const;

type MockContentItem = {
  categoryId?: string;
  contentType?: string;
};

/** Mirrors the SDK category-navigation guard for tests using shared SDK mocks. */
export const isCategoryNavigationItem = (item: MockContentItem) =>
  item.contentType === "category" && typeof item.categoryId === "string";

export const NetworkState = {
  CONNECT: "CONNECT",
  DISCONNECT: "DISCONNECT",
  LOCAL_ONLY: "LOCAL_ONLY",
} as const;

export const NetworkType = {
  CELLUAR: "CELLULAR", // SDK spelling.
  WIFI: "WIFI",
  WIRED: "WIRED",
} as const;

export const PlaybackPlayerState = {
  BUFFERING: "buffering",
  ENDED: "ended",
  ERROR: "error",
  IDLE: "idle",
  LOADING: "loading",
  PAUSED: "paused",
  PLAYING: "playing",
  READY: "ready",
} as const;

export const PlaybackSourceType = {
  DASH: "dash",
  HLS: "hls",
  PROGRESSIVE: "progressive",
} as const;

export const PlayerErrorCode = {
  CONTENT_UNAVAILABLE: "PLAY_002",
  DEVICE_NOT_SUPPORTED: "PLAY_004",
  FORMAT_NOT_SUPPORTED: "PLAY_006",
  MAINTENANCE: "SYS_003",
  NETWORK_OFFLINE: "NET_001",
  NETWORK_UNSTABLE: "NET_002",
  PLAYBACK_AUTHORISATION_FAILED: "PLAY_005",
  PLAYBACK_FAILED: "PLAY_001",
  PLAYBACK_INTERRUPTED: "PLAY_007",
  REGION_RESTRICTED: "PLAY_003",
  SERVER_UNAVAILABLE: "NET_003",
  TOO_MANY_DEVICES: "PLAY_008",
  UNEXPECTED_ERROR: "SYS_002",
} as const;

export class SynamediaGoApiError extends Error {
  readonly code: string | undefined;
  readonly reason: "device_not_registered" | undefined;
  readonly status: number;
  readonly statusText: string;

  constructor({
    code,
    reason,
    status,
    statusText,
  }: {
    code?: string;
    reason?: "device_not_registered";
    status: number;
    statusText: string;
  }) {
    super(`Synamedia Go request failed: ${code ?? status}`);
    this.code = code;
    this.reason = reason;
    this.status = status;
    this.statusText = statusText;
  }
}

/** Matches the SDK: only its removal reason counts, not a status or code. */
export function isDeviceNotRegisteredError(error: unknown) {
  return (
    error instanceof SynamediaGoApiError &&
    error.reason === "device_not_registered"
  );
}
