import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "@/components";
import { useLiveChannels } from "@/features/live-channels";
import { usePlaybackLauncher } from "@/features/video-player";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { NoResults } from "./components/no-results";
import { SearchInput } from "./components/search-input";
import { SearchResultsGrid } from "./components/search-results-grid";
import { useSearchResults } from "./hooks/use-search-results";
import type { SearchResultDestination } from "./search-result-items";

const PHONE_HORIZONTAL_PADDING = 16;
const TABLET_HORIZONTAL_PADDING = 40;
const CONTENT_TOP_PADDING = 16;
const BACK_ICON_SIZE = 20;
const PHONE_BACK_MARGIN_TOP = 16;
const TABLET_BACK_MARGIN_TOP = 23;

type SearchScreenProps = {
  onSubmit?: (query: string) => void;
};

/** Hosts search with back navigation to the route that opened it. */
export function SearchScreen({ onSubmit }: SearchScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceLayout();
  const { channels, isLoading: isChannelsLoading } = useLiveChannels();
  const { openLiveChannel } = usePlaybackLauncher();
  const search = useSearchResults();
  const preserveQueryOnBlurRef = useRef(false);
  const horizontalPadding = isTablet
    ? TABLET_HORIZONTAL_PADDING
    : PHONE_HORIZONTAL_PADDING;

  useFocusEffect(
    useCallback(
      () => () => {
        if (preserveQueryOnBlurRef.current) {
          preserveQueryOnBlurRef.current = false;
          return;
        }

        search.setDraftQuery("");
      },
      [search.setDraftQuery],
    ),
  );

  function submitQuery(query: string) {
    search.submitQuery(query);
    onSubmit?.(query);
  }

  function goBack() {
    router.back();
  }

  function openResult(destination: SearchResultDestination) {
    Keyboard.dismiss();

    if (destination.kind === "live") {
      void openLiveChannel(destination.channelId);
      return;
    }

    preserveQueryOnBlurRef.current = true;

    if (destination.kind === "show") {
      router.navigate({
        params: { showId: destination.showId },
        pathname: "/search/show/[showId]",
      });
      return;
    }

    router.navigate({
      params: { assetId: destination.assetId },
      pathname: "/search/watch/[assetId]",
    });
  }

  function openChannel(channelId: string) {
    Keyboard.dismiss();
    preserveQueryOnBlurRef.current = true;
    router.navigate({
      params: { channelId },
      pathname: "/search/channel/[channelId]",
    });
  }

  const showRecommendations =
    !search.submittedQuery || (search.isEmpty && !search.isLoading);

  return (
    <View className="flex-1 bg-dark-slate-blue" testID="search-screen">
      <View
        style={{
          paddingLeft: horizontalPadding + insets.left,
          paddingRight: horizontalPadding + insets.right,
          paddingTop: insets.top,
        }}
      >
        <BackButton
          iconHeight={BACK_ICON_SIZE}
          iconWidth={BACK_ICON_SIZE}
          onPress={goBack}
          style={{
            marginTop: isTablet
              ? TABLET_BACK_MARGIN_TOP
              : PHONE_BACK_MARGIN_TOP,
          }}
          testID="search-back"
        />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        style={{
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{
            paddingLeft: horizontalPadding + insets.left,
            paddingRight: horizontalPadding + insets.right,
            paddingTop: CONTENT_TOP_PADDING,
          }}
        >
          <SearchInput
            onChangeText={search.setDraftQuery}
            onSubmit={submitQuery}
            value={search.draftQuery}
          />
        </View>
        <View className="flex-1">
          <Pressable
            accessible={false}
            onPress={Keyboard.dismiss}
            style={StyleSheet.absoluteFill}
            testID="search-screen-dismiss-keyboard"
          />
          {showRecommendations && !search.error ? (
            <NoResults
              channels={channels}
              hasSearched={Boolean(search.submittedQuery)}
              isChannelsLoading={isChannelsLoading}
              onChannelPress={openChannel}
              onRecommendationPress={openResult}
            />
          ) : (
            <SearchResultsGrid
              channels={channels}
              error={search.error}
              isLoading={search.isLoading}
              items={search.items}
              onResultPress={openResult}
              onRetry={search.retry}
              submittedQuery={search.submittedQuery}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
