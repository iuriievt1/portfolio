import { useRouter } from "expo-router";
import { ON_NOW_SECTION_ROUTE } from "@/features/content-rails/app-content";
import { PageRailsList } from "@/features/content-rails/components/page-rails-list/page-rails-list";
import { useAppContentPage } from "@/features/content-rails/hooks/use-app-content-page";

/** Renders the second Common SDK section as the On Now tab. */
export default function OnNowScreen() {
  const router = useRouter();
  const pageRailsListProps = useAppContentPage(ON_NOW_SECTION_ROUTE, {
    onChannelPress: (channel) => {
      router.navigate({
        params: { channelId: channel.id },
        pathname: "/on-now/channel/[channelId]",
      });
    },
    onViewAllPress: (rail) => {
      router.navigate({
        params: {
          railId: rail.category.id,
          sectionRoute: ON_NOW_SECTION_ROUTE,
        },
        pathname: "/on-now/view-all/[railId]",
      });
    },
    onShowPress: (showId) => {
      router.navigate({
        params: { showId },
        pathname: "/on-now/show/[showId]",
      });
    },
    onVodAssetPress: (item) => {
      router.navigate({
        params: { assetId: item.id },
        pathname: "/on-now/watch/[assetId]",
      });
    },
  });

  return <PageRailsList {...pageRailsListProps} />;
}
