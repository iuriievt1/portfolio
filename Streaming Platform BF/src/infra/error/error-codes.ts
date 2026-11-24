/** Mirrors PlayerErrorCode: this barrel must not pull the SDK. */
export const errorCodes = {
  contentRemoved: "CNT_002",
  contentUnavailable: "PLAY_002",
  offline: "NET_001",
  serverUnavailable: "NET_003",
  timedOut: "NET_004",
  unexpected: "SYS_002",
  updateRequired: "SYS_001",
} as const;
