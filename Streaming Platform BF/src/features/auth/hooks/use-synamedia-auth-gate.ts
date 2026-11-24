import {
  Auth,
  DevicePairingPollStatus,
  type DevicePairingSession,
  type SignInInput,
  type SignOutOptions,
} from "@bfbs/common-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { trackPostLoginAppStart } from "@/features/analytics/app-analytics";
import {
  trackSignIn,
  trackSignOut,
} from "@/features/analytics/logon-analytics";
import {
  dismissErrorModal,
  getErrorEntry,
  reportError,
  showErrorModal,
} from "@/infra/error";
import {
  isTimeoutError,
  isTransportError,
} from "@/infra/error/utils/classify-error";
import { featurevisorService } from "@/infra/feature-flags/featurevisor-service";
import { theme } from "@/theme/theme";
import {
  clearDeviceRemoved,
  useIsDeviceRemoved,
} from "../device-removed-store";
import {
  consumeSignInRequest,
  requestSignIn,
  useIsSignInRequested,
} from "../sign-in-request-store";
import type { SynamediaAuthState } from "../types";
import {
  isDeviceIntegrityAllowed,
  isDeviceIntegrityEnabled,
} from "../utils/device-integrity";
import { isDeviceQuotaReached } from "../utils/device-quota";
import { handleDeviceRemoval } from "../utils/device-removal";
import {
  getInitialPairingPollIntervalSeconds,
  getNextPairingPollIntervalSeconds,
} from "../utils/pairing-polling";
import {
  clearPendingDeviceRegistration,
  hasPendingDeviceRegistration,
  setPendingDeviceRegistration,
} from "../utils/pending-device-registration";
import { isSessionExpiredError } from "../utils/session-expiry";
import {
  getSignInErrorCode,
  getSignInFailureCode,
  SignInError,
} from "../utils/sign-in-error";
import { hasStoredSynamediaAuthSession } from "../utils/synamedia-storage";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** Drops a half-made session. */
async function discardPartialSession(options?: SignOutOptions) {
  try {
    await Auth.signOut(options);
  } catch (error) {
    reportError(error, { tags: { area: "auth", operation: "sign_out" } });
  }
}

async function dismissSynamediaBrowser() {
  try {
    await WebBrowser.dismissBrowser();
  } catch {
    // Some platforms cannot dismiss programmatically after the external flow.
  }
}

function waitForAndroidBrowserReturn() {
  if (Platform.OS !== "android") {
    return {
      cancel: () => {},
      promise: Promise.resolve(),
    };
  }

  let hasLeftApp = AppState.currentState !== "active";
  let subscription: { remove: () => void } | undefined;

  const promise = new Promise<void>((resolve) => {
    subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        hasLeftApp = true;
        return;
      }

      if (hasLeftApp) {
        subscription?.remove();
        resolve();
      }
    });
  });

  return {
    cancel: () => subscription?.remove(),
    promise,
  };
}

/** Stops a pending pairing poll; takes the ref so effects can call it too. */
function clearPendingPoll(timeoutRef: {
  current: ReturnType<typeof setTimeout> | null;
}) {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

async function openSynamediaBrowser(loginUrl: string) {
  const androidBrowserReturn = waitForAndroidBrowserReturn();

  try {
    await WebBrowser.openBrowserAsync(loginUrl, {
      controlsColor: theme.colors.white,
      dismissButtonStyle: "done",
      toolbarColor: theme.colors.black,
    });
    await androidBrowserReturn.promise;
  } finally {
    androidBrowserReturn.cancel();
  }
}

/** Owns authentication and signed-in integrity checks for startup, foreground and playback. */
export function useSynamediaAuthGate() {
  const [state, setRenderedState] = useState<SynamediaAuthState>({
    status: "checking-session",
  });
  const stateRef = useRef(state);
  // Native listeners and playback requests need the latest state before React renders.
  const setState = useCallback((nextState: SynamediaAuthState) => {
    stateRef.current = nextState;
    setRenderedState(nextState);
  }, []);
  const isSignInRequested = useIsSignInRequested();
  // Snapshot: the effect below consumes the request before the mount effect reads it.
  const [wasSignInRequestedAtMount] = useState(isSignInRequested);
  const isDeviceRemoved = useIsDeviceRemoved();
  const queryClient = useQueryClient();
  const activeFlowId = useRef(0);
  const isMountedRef = useRef(true);
  const isSigningOutRef = useRef(false);
  const signOutPromiseRef = useRef<Promise<void> | null>(null);
  const isSubmittingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockedSessionStatusRef = useRef<"ready" | "too-many-devices">("ready");

  const clearPollingTimeout = () => clearPendingPoll(timeoutRef);

  const checkDeviceIntegrity = useCallback(
    async (
      flowId: number,
      sessionStatus: "ready" | "too-many-devices" = "ready",
    ) => {
      const isCurrentFlow = () =>
        isMountedRef.current &&
        activeFlowId.current === flowId &&
        !isSigningOutRef.current &&
        !signOutPromiseRef.current;

      if (!isCurrentFlow()) {
        return false;
      }
      const allowed = await isDeviceIntegrityAllowed();
      if (!isCurrentFlow()) {
        return false;
      }

      if (!allowed) {
        // Invalidate concurrent checks so a later pass cannot undo this failure.
        activeFlowId.current += 1;
        blockedSessionStatusRef.current = sessionStatus;
        clearPendingPoll(timeoutRef);
        setState({ status: "device-not-authorised" });
        dismissErrorModal();
        void queryClient.cancelQueries(
          { queryKey: ["playSession"] },
          { silent: true },
        );
      }
      return allowed;
    },
    [queryClient, setState],
  );

  const checkAuthenticatedDevice = useCallback(async () => {
    if (stateRef.current.status !== "ready") {
      return false;
    }
    return checkDeviceIntegrity(activeFlowId.current);
  }, [checkDeviceIntegrity]);

  const bootstrapAuthenticatedSession = useCallback(
    async ({
      failureMessage,
      flowId,
      isNewSignIn = false,
    }: {
      failureMessage: string;
      flowId: number;
      isNewSignIn?: boolean;
    }) => {
      if (activeFlowId.current !== flowId) {
        return;
      }

      setState({ status: "bootstrapping" });

      try {
        await Auth.bootstrapSession();
      } catch (error) {
        if (activeFlowId.current !== flowId) {
          return;
        }

        // Network, timeout and expired-session errors can't mean the household is full.
        const shouldCheckQuota =
          isNewSignIn &&
          !(
            isTransportError(error) ||
            isTimeoutError(error) ||
            isSessionExpiredError(error)
          );

        // AUTH_021: a new sign-in found the household full. Keep the tokens.
        if (shouldCheckQuota && (await isDeviceQuotaReached())) {
          reportError(error, {
            tags: { area: "auth", operation: "device_quota_reached" },
          });

          if (activeFlowId.current === flowId && isMountedRef.current) {
            setPendingDeviceRegistration();
            if (!(await checkDeviceIntegrity(flowId, "too-many-devices"))) {
              return;
            }
            setState({ status: "too-many-devices" });
            showErrorModal("AUTH_021");
          }
          return;
        }

        if (handleDeviceRemoval(error)) {
          return;
        }

        if (isSessionExpiredError(error)) {
          await discardPartialSession();
          queryClient.clear();

          if (activeFlowId.current === flowId && isMountedRef.current) {
            setState({
              errorMessage: getErrorMessage(error, failureMessage),
              status: "signed-out",
            });
          }
          return;
        }

        if (!(isTransportError(error) || isTimeoutError(error))) {
          reportError(error, {
            tags: { area: "auth", operation: "bootstrap_session" },
          });
        }

        if (isMountedRef.current) {
          setState({ status: "bootstrap-error" });
        }
        return;
      }

      if (activeFlowId.current === flowId && isMountedRef.current) {
        clearPendingDeviceRegistration();
        if (!(await checkDeviceIntegrity(flowId))) {
          return;
        }
        setState({ status: "ready" });
      }
    },
    [checkDeviceIntegrity, queryClient, setState],
  );

  const schedulePairingPoll = ({
    deviceCode,
    expiresAt,
    flowId,
    intervalSeconds,
  }: {
    deviceCode: string;
    expiresAt: number;
    flowId: number;
    intervalSeconds: number;
  }) => {
    clearPollingTimeout();

    timeoutRef.current = setTimeout(async () => {
      if (activeFlowId.current !== flowId) {
        return;
      }

      if (Date.now() >= expiresAt) {
        void dismissSynamediaBrowser();
        setState({
          status: "expired",
        });
        return;
      }

      try {
        const result = await Auth.pollDevicePairingCode({ deviceCode });

        if (activeFlowId.current !== flowId) {
          return;
        }

        switch (result.status) {
          case DevicePairingPollStatus.AUTHENTICATED:
            void dismissSynamediaBrowser();
            trackSignIn();
            trackPostLoginAppStart();
            await bootstrapAuthenticatedSession({
              failureMessage: "Failed to prepare the authenticated session.",
              flowId,
              isNewSignIn: true,
            });
            return;

          case DevicePairingPollStatus.DENIED:
            void dismissSynamediaBrowser();
            setState({
              errorMessage:
                result.errorDescription ?? "The sign-in request was denied.",
              status: "denied",
            });
            return;

          case DevicePairingPollStatus.EXPIRED:
            void dismissSynamediaBrowser();
            setState({
              errorMessage:
                result.errorDescription ?? "The sign-in request expired.",
              status: "expired",
            });
            return;

          case DevicePairingPollStatus.PENDING:
          case DevicePairingPollStatus.SLOW_DOWN: {
            const nextIntervalSeconds = getNextPairingPollIntervalSeconds({
              currentIntervalSeconds: intervalSeconds,
              result,
            });

            schedulePairingPoll({
              deviceCode,
              expiresAt,
              flowId,
              intervalSeconds: nextIntervalSeconds,
            });
            return;
          }

          default:
            return result satisfies never;
        }
      } catch (error) {
        if (activeFlowId.current === flowId) {
          setState({
            errorMessage: getErrorMessage(
              error,
              "Failed while polling the sign-in session.",
            ),
            status: "error",
          });
        }
      }
    }, intervalSeconds * 1000);
  };

  const startSignIn = async () => {
    const flowId = activeFlowId.current + 1;
    activeFlowId.current = flowId;
    clearPollingTimeout();
    setState({
      status: "opening-browser",
    });

    try {
      const pairingSession: DevicePairingSession =
        await Auth.getDevicePairingCode();
      const loginUrl =
        pairingSession.verificationUriComplete ??
        pairingSession.verificationUri;
      const expiresAt = Date.now() + pairingSession.expiresInSeconds * 1000;

      if (activeFlowId.current !== flowId) {
        return;
      }

      setState({
        expiresAt,
        loginUrl,
        status: "waiting-for-approval",
        userCode: pairingSession.userCode,
      });

      await openSynamediaBrowser(loginUrl);

      if (activeFlowId.current !== flowId) {
        return;
      }

      schedulePairingPoll({
        deviceCode: pairingSession.deviceCode,
        expiresAt,
        flowId,
        intervalSeconds: getInitialPairingPollIntervalSeconds(
          pairingSession.intervalSeconds,
        ),
      });
    } catch (error) {
      if (activeFlowId.current === flowId) {
        setState({
          errorMessage: getErrorMessage(
            error,
            "Failed to start the sign-in session.",
          ),
          status: "error",
        });
      }
    }
  };

  /** Failure stays on the form. */
  const signInMutation = useMutation({
    mutationFn: async (credentials: SignInInput) => {
      const flowId = activeFlowId.current + 1;
      activeFlowId.current = flowId;
      clearPollingTimeout();

      try {
        await Auth.signIn(credentials);
      } catch (error) {
        throw new SignInError({
          cause: error,
          code: getSignInErrorCode(error),
        });
      }

      return flowId;
    },
    onError: (error) => {
      const code = getSignInFailureCode(error);

      reportError(error instanceof SignInError ? error.cause : error, {
        tags: { area: "auth", code, operation: "sign_in" },
      });

      if (getErrorEntry(code).presentation === "modal") {
        showErrorModal(code);
      }
    },
    onSettled: () => {
      isSubmittingRef.current = false;
    },
    onSuccess: (flowId) => {
      if (activeFlowId.current === flowId) {
        trackSignIn();
        trackPostLoginAppStart();
        void bootstrapAuthenticatedSession({
          failureMessage: "Failed to prepare the authenticated session.",
          flowId,
          isNewSignIn: true,
        });
      }
    },
  });

  /** A second press inside the same frame would cost the reader an attempt. */
  const signIn = (credentials: SignInInput) => {
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    signInMutation.mutate(credentials);
  };

  const { reset: resetSignIn } = signInMutation;

  /** Ends the active session once and removes account-scoped server state. */
  const signOut = () => {
    if (signOutPromiseRef.current) {
      return signOutPromiseRef.current;
    }

    activeFlowId.current += 1;
    const signOutPromise = Auth.signOut()
      .then(() => {
        trackSignOut();
        clearPollingTimeout();
        queryClient.clear();
        resetSignIn();

        if (isMountedRef.current) {
          setState({ status: "signed-out" });
        }
      })
      .finally(() => {
        signOutPromiseRef.current = null;
      });

    signOutPromiseRef.current = signOutPromise;
    return signOutPromise;
  };

  /** AUTH_021: after a removal, registers this device and opens the app. */
  const registerAfterRemoval = async () => {
    const flowId = activeFlowId.current + 1;
    activeFlowId.current = flowId;

    try {
      await Auth.bootstrapSession();
    } catch (error) {
      reportError(error, {
        tags: { area: "auth", operation: "register_after_removal" },
      });
      return;
    }

    if (activeFlowId.current === flowId && isMountedRef.current) {
      clearPendingDeviceRegistration();
      if (!(await checkDeviceIntegrity(flowId))) {
        return;
      }
      setState({ status: "ready" });
    }
  };

  const retryBootstrap = () => {
    if (isSigningOutRef.current) {
      return undefined;
    }

    const flowId = activeFlowId.current + 1;
    activeFlowId.current = flowId;
    clearPollingTimeout();

    return bootstrapAuthenticatedSession({
      failureMessage: "Failed to prepare the saved session.",
      flowId,
    });
  };

  /** AUTH_020 Sign In: clears the flag and opens the sign-in form. */
  const signInAfterDeviceRemoved = () => {
    clearDeviceRemoved();
    setState({ status: "signed-out" });
  };

  // Apply live enforcement changes without rerendering the app for every flag refresh.
  useEffect(() => {
    let enabled = isDeviceIntegrityEnabled();
    return featurevisorService.subscribe(() => {
      const nextEnabled = isDeviceIntegrityEnabled();
      if (enabled === nextEnabled) {
        return;
      }
      enabled = nextEnabled;
      const status = stateRef.current.status;
      if (!enabled && status === "device-not-authorised") {
        setState({ status: blockedSessionStatusRef.current });
      } else if (
        enabled &&
        (status === "ready" || status === "too-many-devices")
      ) {
        void checkDeviceIntegrity(activeFlowId.current, status);
      }
    });
  }, [checkDeviceIntegrity, setState]);

  // Show AUTH_020 first so app screens unmount, then forget the device.
  useEffect(() => {
    if (!isDeviceRemoved) {
      return;
    }

    // Clear the flag at once, so a later removal can raise it again.
    clearDeviceRemoved();

    if (state.status === "device-removed") {
      return;
    }

    activeFlowId.current += 1;
    clearPendingPoll(timeoutRef);
    resetSignIn();
    setState({ status: "device-removed" });
    dismissErrorModal();

    void discardPartialSession({ forgetDevice: true }).then(() =>
      queryClient.clear(),
    );
  }, [isDeviceRemoved, queryClient, resetSignIn, setState, state.status]);

  useEffect(() => {
    if (!isSignInRequested) {
      return;
    }

    consumeSignInRequest();
    resetSignIn();

    if (
      state.status === "signed-out" ||
      state.status === "device-removed" ||
      isSigningOutRef.current
    ) {
      return;
    }

    isSigningOutRef.current = true;
    activeFlowId.current += 1;
    const flowId = activeFlowId.current;
    clearPendingPoll(timeoutRef);

    void discardPartialSession().then(() => {
      queryClient.clear();
      isSigningOutRef.current = false;

      if (activeFlowId.current === flowId && isMountedRef.current) {
        setState({ status: "signed-out" });
      }
    });
  }, [isSignInRequested, queryClient, resetSignIn, setState, state.status]);

  useEffect(() => {
    if (wasSignInRequestedAtMount || !hasStoredSynamediaAuthSession()) {
      setState({
        status: "signed-out",
      });
      return undefined;
    }

    // AUTH_021 was left before this device was registered, so sign in again.
    if (hasPendingDeviceRegistration()) {
      void discardPartialSession().then(() =>
        setState({ status: "signed-out" }),
      );
      return undefined;
    }

    const flowId = activeFlowId.current;
    void bootstrapAuthenticatedSession({
      failureMessage: "Failed to prepare the saved session.",
      flowId,
    });
  }, [bootstrapAuthenticatedSession, setState, wasSignInRequestedAtMount]);

  useEffect(() => {
    let wasBackgrounded = AppState.currentState === "background";
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background") {
        wasBackgrounded = true;
      }
      if (nextState !== "active" || !wasBackgrounded) {
        return;
      }
      wasBackgrounded = false;

      if (
        stateRef.current.status === "ready" ||
        stateRef.current.status === "too-many-devices"
      ) {
        void checkDeviceIntegrity(
          activeFlowId.current,
          stateRef.current.status,
        );
      }
    });
    return () => subscription.remove();
  }, [checkDeviceIntegrity]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      activeFlowId.current += 1;
      clearPendingPoll(timeoutRef);
    };
  }, []);

  return {
    checkAuthenticatedDevice,
    dismissSignInError: resetSignIn,
    isSigningIn: signInMutation.isPending,
    registerAfterRemoval,
    returnToSignIn: requestSignIn,
    retryBootstrap,
    signIn,
    signInAfterDeviceRemoved,
    signInErrorCode: signInMutation.isError
      ? getSignInFailureCode(signInMutation.error)
      : null,
    startSignIn,
    state,
    signOut,
  };
}
