import { View } from "react-native";
import { WatchDetailsTabButton } from "@/features/watch-details/components/watch-details-tabs/watch-details-tab-button";

// Tablet tabs are wider, with larger text.
const TABLET_TAB_PROPS = {
  className: "w-[116px]",
  textSizeClassName: "text-[16px]",
};

/** The selected tab while it's shown, else the first tab shown. */
export function getActiveTab<Tab extends string>(
  tabs: readonly { tab: Tab }[],
  selectedTab: Tab,
): Tab {
  if (tabs.some(({ tab }) => tab === selectedTab)) {
    return selectedTab;
  }
  return tabs[0]?.tab ?? selectedTab;
}

/** A row of watch-details tabs, shared by film and series pages on phone and tablet. */
export function WatchDetailsTabRow<Tab extends string>({
  isTablet = false,
  onSelect,
  selectedTab,
  tabs,
}: {
  isTablet?: boolean;
  onSelect: (tab: Tab) => void;
  selectedTab: Tab;
  tabs: readonly { label: string; tab: Tab }[];
}) {
  return (
    <View className={isTablet ? "flex-row gap-4" : "flex-row gap-2"}>
      {tabs.map(({ label, tab }) => (
        <WatchDetailsTabButton
          {...(isTablet ? TABLET_TAB_PROPS : {})}
          isActive={selectedTab === tab}
          key={tab}
          label={label}
          onPress={() => onSelect(tab)}
        />
      ))}
    </View>
  );
}
