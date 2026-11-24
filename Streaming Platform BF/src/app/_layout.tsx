import "../../global.css";

import { PortalProvider } from "@gorhom/portal";
import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as NativeSplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, View } from "react-native";
import { trackAppStart } from "@/features/analytics/app-analytics";
import { requestSignIn, SynamediaAuthGate } from "@/features/auth";
import {
  appContentQueryOptions,
  assertInitialHomeContentReady,
} from "@/features/content-rails/app-content";
import { SplashScreen, useSplashScreen } from "@/features/splash-screen";
import { useAppUpdateError } from "@/infra/app-version/use-app-update-error";
import { configureCommonSdk } from "@/infra/common-sdk";
import {
  ErrorModalHost,
  reportError,
  StartupErrorScreen,
  useConnectivityError,
} from "@/infra/error";
import { initFeatureFlags } from "@/infra/feature-flags";
import { appQueryClient } from "@/infra/query/app-query-client";
import { lockPortraitOnPhone } from "@/utils/orientation";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const sentryEnvironment =
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? "development";
const sentryNavigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

const PLAYER_SCREEN_ANIMATION = Platform.OS === "ios" ? "none" : "default";

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnvironment,
    sendDefaultPii: false,
    tracesSampleRate: 1.0,
    integrations: [sentryNavigationIntegration],
  });
}

void NativeSplashScreen.preventAutoHideAsync();
void lockPortraitOnPhone();

async function preloadInitialHomeContent() {
  const appContent = await appQueryClient.ensureQueryData(
    appContentQueryOptions,
  );

  assertInitialHomeContentReady(appContent);
}

/** Coordinates BFBS app startup, providers, auth gating, and root navigation. */
export function RootLayout() {
  const navigationContainerRef = useNavigationContainerRef();
  const [fontsLoaded] = useFonts({
    EuclidLight: require("@/assets/fonts/euclid-circular-a/Euclid-Circular-A-Light.ttf"),
    EuclidNormal: require("@/assets/fonts/euclid-circular-a/Euclid-Circular-A-Regular.ttf"),
    EuclidMedium: require("@/assets/fonts/euclid-circular-a/Euclid-Circular-A-Medium.ttf"),
    EuclidSemiBold: require("@/assets/fonts/euclid-circular-a/Euclid-Circular-A-SemiBold.ttf"),
    EuclidBold: require("@/assets/fonts/euclid-circular-a/Euclid-Circular-A-Bold.ttf"),
  });

  const [isAppReady, setIsAppReady] = useState(false);
  const [appInitialisationError, setAppInitialisationError] =
    useState<unknown>();

  const isMounted = useRef(true);

  const { isSplashVisible, splashOpacity } = useSplashScreen({
    isAppReady,
    fontsLoaded,
    hasInitialisationError: appInitialisationError !== undefined,
  });

  useEffect(() => {
    if (sentryDsn && navigationContainerRef?.current) {
      sentryNavigationIntegration.registerNavigationContainer(
        navigationContainerRef,
      );
    }
  }, [navigationContainerRef]);

  const startInitialisation = useCallback(() => {
    setAppInitialisationError(undefined);
    setIsAppReady(false);

    void Promise.all([
      configureCommonSdk().then(() => {
        // Analytics must never stop the app from starting.
        try {
          trackAppStart();
        } catch (error) {
          reportError(error, {
            tags: { area: "startup", operation: "track_app_start" },
          });
        }
      }),
      initFeatureFlags(),
    ])
      .then(() => {
        if (isMounted.current) {
          setAppInitialisationError(undefined);
          setIsAppReady(true);
        }

        void preloadInitialHomeContent().catch((error: unknown) => {
          // Home content is warmed opportunistically; screens own content errors.
          reportError(error, {
            tags: {
              area: "startup",
              operation: "preload_initial_home_content",
            },
          });
        });
      })
      .catch((error: unknown) => {
        if (isMounted.current) {
          setAppInitialisationError(error);
        }
      });
  }, []);

  useEffect(() => {
    startInitialisation();

    return () => {
      isMounted.current = false;
    };
  }, [startInitialisation]);

  const retryInitialisation = useCallback(() => {
    startInitialisation();
  }, [startInitialisation]);

  useConnectivityError();
  useAppUpdateError(isAppReady);

  return (
    <PortalProvider>
      <QueryClientProvider client={appQueryClient}>
        <View className="flex-1 bg-black">
          {fontsLoaded && appInitialisationError ? (
            <StartupErrorScreen
              error={appInitialisationError}
              onRetry={retryInitialisation}
            />
          ) : null}
          {fontsLoaded && isAppReady && !appInitialisationError ? (
            <SynamediaAuthGate>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="player/live/[channelId]"
                  options={{
                    animation: PLAYER_SCREEN_ANIMATION,
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="player/vod/[id]"
                  options={{
                    animation: PLAYER_SCREEN_ANIMATION,
                    gestureEnabled: false,
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="tv-guide/index"
                  options={{ headerShown: false }}
                />
                <Stack.Protected
                  guard={process.env.EXPO_PUBLIC_ENVIRONMENT === "storybook"}
                >
                  <Stack.Screen name="storybook" />
                </Stack.Protected>
              </Stack>
            </SynamediaAuthGate>
          ) : null}
          {isSplashVisible ? (
            <Animated.View
              className="absolute inset-0"
              style={{ opacity: splashOpacity }}
            >
              <SplashScreen />
            </Animated.View>
          ) : null}
        </View>
      </QueryClientProvider>
      <ErrorModalHost onSignIn={requestSignIn} />
    </PortalProvider>
  );
}

export default Sentry.wrap(RootLayout);
