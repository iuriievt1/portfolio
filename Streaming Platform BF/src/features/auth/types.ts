export type SynamediaAuthStatus =
  | "checking-session"
  | "signed-out"
  | "opening-browser"
  | "waiting-for-approval"
  | "bootstrapping"
  | "bootstrap-error"
  | "ready"
  | "denied"
  | "expired"
  | "error"
  | "device-removed"
  | "device-not-authorised"
  | "too-many-devices";

export interface SynamediaAuthState {
  errorMessage?: string;
  expiresAt?: number;
  loginUrl?: string;
  status: SynamediaAuthStatus;
  userCode?: string;
}
