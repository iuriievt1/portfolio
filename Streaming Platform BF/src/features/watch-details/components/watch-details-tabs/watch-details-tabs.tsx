import type { ContentItem } from "@bfbs/common-sdk";
import { useState } from "react";
import { View } from "react-native";
import { MoreDetailsPane } from "@/features/watch-details/components/more-details-pane/more-details-pane";
import { RelatedPane } from "@/features/watch-details/components/related-pane/related-pane";
import {
  getActiveTab,
  WatchDetailsTabRow,
} from "@/features/watch-details/components/watch-details-tabs/watch-details-tab-row";
import { hasRelatedContent } from "@/features/watch-details/related-content";
import { hasMoreDetails } from "@/features/watch-details/utils/more-details";

export type WatchDetailsTab = "related" | "more-details";

const WATCH_DETAILS_TABS: { label: string; tab: WatchDetailsTab }[] = [
  { label: "Related", tab: "related" },
  { label: "More Details", tab: "more-details" },
];

/** Show each only when it has something to show. */
export function getWatchDetailsTabs(
  showsRelated: boolean,
  showsMoreDetails: boolean,
) {
  return WATCH_DETAILS_TABS.filter(({ tab }) =>
    tab === "related" ? showsRelated : showsMoreDetails,
  );
}

/** Related is the default tab, but only VOD assets have related content. */
export function WatchDetailsTabs({ asset }: { asset: ContentItem }) {
  const showsRelated = hasRelatedContent(asset);
  const tabs = getWatchDetailsTabs(showsRelated, hasMoreDetails(asset));
  const [selectedTab, setSelectedTab] = useState<WatchDetailsTab>("related");
  const activeTab = getActiveTab(tabs, selectedTab);

  // Nothing to show, so no tabs and no gap.
  if (tabs.length === 0) {
    return null;
  }

  return (
    <View className="mt-[30px]">
      <WatchDetailsTabRow
        onSelect={setSelectedTab}
        selectedTab={activeTab}
        tabs={tabs}
      />
      <View className="mt-4">
        {activeTab === "related" ? (
          <RelatedPane asset={asset} />
        ) : (
          <MoreDetailsPane asset={asset} />
        )}
      </View>
    </View>
  );
}
