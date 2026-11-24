import { useLocalSearchParams, useRouter } from "expo-router";
import type { AppSectionRoute } from "@/features/content-rails/app-content";
import { PageRailsList } from "@/features/content-rails/components/page-rails-list/page-rails-list";
import { useAppContentPage } from "@/features/content-rails/hooks/use-app-content-page";

/** Renders a top-navigation section generated from Common SDK navigation. */
export default function DynamicSectionScreen() {
  const router = useRouter();
  const { sectionSlug } = useLocalSearchParams<{ sectionSlug?: string }>();
  const route = `/${sectionSlug ?? ""}` as AppSectionRoute;
  const pageRailsListProps = useAppContentPage(route, {
    onChannelPress: (channel) => {
      router.navigate({
        params: { channelId: channel.id, sectionSlug: sectionSlug ?? "" },
        pathname: "/[sectionSlug]/channel/[channelId]",
      });
    },
    onViewAllPress: (rail) => {
      router.navigate({
        params: {
          railId: rail.category.id,
          sectionRoute: route,
          sectionSlug: sectionSlug ?? "",
        },
        pathname: "/[sectionSlug]/view-all/[railId]",
      });
    },
    onShowPress: (showId) => {
      router.navigate({
        params: { sectionSlug: sectionSlug ?? "", showId },
        pathname: "/[sectionSlug]/show/[showId]",
      });
    },
    onVodAssetPress: (item) => {
      router.navigate({
        params: { assetId: item.id, sectionSlug: sectionSlug ?? "" },
        pathname: "/[sectionSlug]/watch/[assetId]",
      });
    },
  });

  return <PageRailsList {...pageRailsListProps} />;
}
