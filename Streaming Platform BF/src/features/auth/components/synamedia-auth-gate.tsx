import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Button, Text } from "@/components";
import { RouteScreenChangeTracker } from "@/features/analytics/screens/route-screen-change-tracker";
import {
  getAuthAnalyticsScreen,
  screenChangeTracker,
} from "@/features/analytics/screens/screen-change-tracker";
import {
  MyBfbsMobileMenu,
  MyBfbsPageScreen,
  MyBfbsTabletMenu,
} from "@/features/my-bfbs";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import {
  ErrorFullScreen,
  formatErrorCopy,
  getErrorEntry,
  useErrorAction,
} from "@/infra/error";
import { theme } from "@/theme/theme";
import { AuthSessionContext } from "../auth-session-context";
import { useSynamediaAuthGate } from "../hooks/use-synamedia-auth-gate";
import type { SynamediaAuthState } from "../types";
import { SignInDisclaimer } from "./sign-in-disclaimer";
import { SignInScreen } from "./sign-in-screen";

interface SynamediaAuthGateProps {
  children: React.ReactNode;
}

function getStatusMessage(state: SynamediaAuthState) {
  switch (state.status) {
    case "checking-session":
      return "Checking saved sign-in";
    case "signed-out":
    case "device-removed":
      return "Sign in to continue";
    case "device-not-authorised":
      return "Device Not Authorised";
    case "opening-browser":
      return "Opening sign-in";
    case "waiting-for-approval":
      return "Complete sign-in in the browser";
    case "bootstrapping":
      return "Preparing your session";
    case "bootstrap-error":
      return "We couldn't prepare your session. Please try again";
    case "ready":
      return "Sign-in complete";
    case "too-many-devices":
      return "Too many devices";
    case "denied":
      return state.errorMessage ?? "Sign-in was denied";
    case "expired":
      return state.errorMessage ?? "Sign-in expired";
    case "error":
      return state.errorMessage ?? "Sign-in failed";
    default:
      return state.status satisfies never;
  }
}

function canRetry(status: SynamediaAuthState["status"]) {
  return (
    status === "bootstrap-error" ||
    status === "denied" ||
    status === "error" ||
    status === "expired"
  );
}

function isBusy(status: SynamediaAuthState["status"]) {
  return (
    status === "checking-session" ||
    status === "opening-browser" ||
    status === "waiting-for-approval" ||
    status === "bootstrapping"
  );
}

// AUTH_021: the real My BFBS Devices page, phone or tablet, with no Back.
function MyBfbsDevices() {
  const { isTablet } = useDeviceLayout();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (isTablet) {
    return <MyBfbsTabletMenu />;
  }

  // Phone: Back opens the My BFBS menu, where only Devices and Log Out work.
  if (isMenuOpen) {
    return (
      <MyBfbsMobileMenu
        onClose={() => setIsMenuOpen(false)}
        onOpenDevices={() => setIsMenuOpen(false)}
      />
    );
  }

  return <MyBfbsPageScreen item="Devices" onBack={() => setIsMenuOpen(true)} />;
}

/** Gates app content and playback on authentication and local device integrity. */
export function SynamediaAuthGate({ children }: SynamediaAuthGateProps) {
  const {
    checkAuthenticatedDevice,
    dismissSignInError,
    isSigningIn,
    registerAfterRemoval,
    returnToSignIn,
    retryBootstrap,
    signIn,
    signInAfterDeviceRemoved,
    signInErrorCode,
    signOut,
    startSignIn,
    state,
  } = useSynamediaAuthGate();
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(false);
  const signOutToSignIn = () => {
    setHasAcceptedDisclaimer(true);
    return signOut();
  };
  const signInFailure = signInErrorCode
    ? { code: signInErrorCode, entry: getErrorEntry(signInErrorCode) }
    : undefined;
  const handleErrorAction = useErrorAction({ onCancel: dismissSignInError });
  const analyticsScreen =
    state.status === "ready" ? undefined : getAuthAnalyticsScreen(state.status);

  useEffect(() => {
    if (state.status !== "ready") {
      screenChangeTracker.track(analyticsScreen);
    }
  }, [analyticsScreen, state.status]);

  if (state.status === "ready") {
    return (
      <AuthSessionContext
        value={{ checkAuthenticatedDevice, signOut: signOutToSignIn }}
      >
        <RouteScreenChangeTracker />
        {children}
      </AuthSessionContext>
    );
  }

  // AUTH_021: only My BFBS Devices, without the app around it, so the user can't leave.
  if (state.status === "too-many-devices") {
    return (
      <AuthSessionContext
        value={{
          checkAuthenticatedDevice,
          isTooManyDevices: true,
          registerDevice: () => void registerAfterRemoval(),
          signOut: signOutToSignIn,
        }}
      >
        <MyBfbsDevices />
      </AuthSessionContext>
    );
  }

  if (state.status === "device-not-authorised") {
    return <ErrorFullScreen code="AUTH_019" onAction={handleErrorAction} />;
  }

  if (state.status === "device-removed") {
    return (
      <ErrorFullScreen
        code="AUTH_020"
        onAction={() => {
          setHasAcceptedDisclaimer(true);
          signInAfterDeviceRemoved();
        }}
      />
    );
  }

  if (state.status === "signed-out") {
    if (!hasAcceptedDisclaimer) {
      return (
        <SignInDisclaimer onContinue={() => setHasAcceptedDisclaimer(true)} />
      );
    }

    if (signInFailure?.entry.presentation === "full-page") {
      return (
        <ErrorFullScreen
          code={signInFailure.code}
          onAction={handleErrorAction}
        />
      );
    }

    return (
      <SignInScreen
        errorMessage={
          signInFailure?.entry.presentation === "inline"
            ? formatErrorCopy(signInFailure.entry)
            : undefined
        }
        isSubmitting={isSigningIn}
        onSubmit={signIn}
      />
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-dark-slate-blue px-6">
      <View className="w-full max-w-[360px] items-center">
        {isBusy(state.status) ? (
          <ActivityIndicator color={theme.colors.white} size="large" />
        ) : null}

        <Text
          className="mt-5 text-center text-body-base text-white"
          weight="bold"
        >
          {getStatusMessage(state)}
        </Text>

        {state.userCode ? (
          <Text className="mt-3 text-center text-body-small text-grey-20">
            Code: {state.userCode}
          </Text>
        ) : null}

        {canRetry(state.status) ? (
          <>
            <Button
              accessibilityHint={
                state.status === "bootstrap-error"
                  ? "Retries preparing your session"
                  : undefined
              }
              accessibilityLabel="Continue"
              className="mt-6 h-[45px] w-[257px] px-6"
              labelClassName="text-[15px] leading-[18px] text-dark-slate-blue"
              onPress={
                state.status === "bootstrap-error"
                  ? retryBootstrap
                  : startSignIn
              }
              testID="synamedia-sign-in-button"
              variant="primary"
            >
              Continue
            </Button>

            {state.status === "bootstrap-error" ? (
              <Button
                accessibilityHint="Clears this session and returns to sign in"
                accessibilityLabel="Sign out"
                className="mt-3 w-[257px] px-6"
                labelClassName="font-bold text-[14px] text-white"
                onPress={returnToSignIn}
                testID="synamedia-bootstrap-sign-out"
                variant="transparent"
              >
                Sign out
              </Button>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}
