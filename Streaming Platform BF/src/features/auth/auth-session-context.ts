import { createContext, useContext } from "react";

type AuthSessionContextValue = {
  checkAuthenticatedDevice: () => Promise<boolean>;
  // AUTH_021: the user must remove a device before using the app.
  isTooManyDevices?: boolean;
  // AUTH_021: registers this device after a removal and opens the app.
  registerDevice?: () => void;
  signOut: () => Promise<void>;
};

const denyPlayback = async () => false;

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(
  null,
);

/** Returns the authenticated-session actions owned by the auth gate. */
export function useAuthSession() {
  const session = useContext(AuthSessionContext);

  if (!session) {
    throw new Error("useAuthSession must be used inside SynamediaAuthGate");
  }

  return session;
}

/** Gives playback the auth gate's integrity check; no authenticated gate means no playback. */
export function usePlaybackAuthorization() {
  return (
    useContext(AuthSessionContext)?.checkAuthenticatedDevice ?? denyPlayback
  );
}

/** AUTH_021: true while the user must remove a device first. False outside the gate. */
export function useIsTooManyDevices() {
  return useContext(AuthSessionContext)?.isTooManyDevices ?? false;
}

/** AUTH_021: registers this device after a removal. Undefined outside AUTH_021. */
export function useRegisterDevice() {
  return useContext(AuthSessionContext)?.registerDevice;
}
