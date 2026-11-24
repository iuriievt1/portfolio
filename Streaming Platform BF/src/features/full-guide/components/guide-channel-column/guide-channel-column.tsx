import { StyleSheet, View } from "react-native";
import { GuideChannelTile } from "@/features/full-guide/components/guide-channel-tile/guide-channel-tile";
import type { GuideChannel } from "@/features/full-guide/types";
import {
  type GuideMetrics,
  getColumnWidth,
  getRowHeight,
} from "@/features/full-guide/utils/guide-metrics";
import { colors } from "@/theme/colors";

type GuideChannelColumnProps = {
  channels: GuideChannel[];
  metrics: GuideMetrics;
};

/**
 * The fixed channel column: every tile beside its row, outside the horizontal timeline. It scrolls with the
 * rows as plain content and never moves sideways, so nothing can carry a tile out of place.
 */
export function GuideChannelColumn({
  channels,
  metrics,
}: GuideChannelColumnProps) {
  const rowHeight = getRowHeight(metrics);

  return (
    <View
      style={[
        styles.column,
        { height: rowHeight * channels.length, width: getColumnWidth(metrics) },
      ]}
      testID="guide-channel-column"
    >
      {channels.map((channel, index) => (
        <View
          key={channel.id}
          style={[
            styles.slot,
            {
              height: rowHeight,
              paddingLeft: metrics.edgeInset,
              top: index * rowHeight,
            },
          ]}
          testID={`guide-channel-column-${channel.id}`}
        >
          <GuideChannelTile channel={channel} metrics={metrics} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    backgroundColor: colors["dark-slate-blue"],
    left: 0,
    position: "absolute",
    top: 0,
  },
  slot: {
    left: 0,
    position: "absolute",
  },
});
