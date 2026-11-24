import { type Animated, Pressable } from "react-native";
import { Text } from "@/components";
import { getTextBox } from "@/features/full-guide/components/guide-card/card-geometry";
import { CardText } from "@/features/full-guide/components/guide-card/card-text";
import type { GuideCell } from "@/features/full-guide/types";
import {
  CARD_BORDER,
  CARD_RADIUS,
  type GuideMetrics,
} from "@/features/full-guide/utils/guide-metrics";
import { getDeviceTimeZone } from "@/utils/date-time";
import { formatProgrammeOnAirWindow } from "@/utils/programme";

const LINE_LIMIT = 1;

type GuideCardProps = {
  cell: GuideCell;
  /** How much of the card sits under the pinned column, for text drawn still. */
  hiddenWidth: number;
  isOnAir: boolean;
  isSelected: boolean;
  left: number;
  metrics: GuideMetrics;
  onSelectCell: (cellId: string) => void;
  /** The timeline's native offset when the text should follow the scroll; null draws it still. */
  scrollOffset: Animated.Value | null;
  timeZone?: string;
  width: number;
};

/** One programme card positioned on the shared timeline canvas. */
export function GuideCard({
  cell,
  hiddenWidth,
  isOnAir,
  isSelected,
  left,
  metrics,
  onSelectCell,
  scrollOffset,
  timeZone = getDeviceTimeZone(),
  width,
}: GuideCardProps) {
  const box = getTextBox(width, metrics);
  const edgeClassName = isSelected
    ? "border-golden-yellow"
    : "border-transparent-white-10";

  return (
    <Pressable
      accessibilityLabel={cell.programme.title}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className={`absolute top-0 bg-medium-slate-blue ${edgeClassName}`}
      onPress={() => onSelectCell(cell.id)}
      style={{
        borderRadius: CARD_RADIUS,
        borderWidth: CARD_BORDER,
        height: metrics.cellHeight,
        left,
        width,
      }}
      testID={`guide-cell-${cell.id}`}
    >
      {box.width > 0 ? (
        <CardText
          box={box}
          hiddenWidth={hiddenWidth}
          left={left}
          metrics={metrics}
          scrollOffset={scrollOffset}
          testID={`guide-cell-text-${cell.id}`}
        >
          <Text
            className={`text-white ${isOnAir ? "" : "opacity-60"}`}
            numberOfLines={LINE_LIMIT}
            style={{ fontSize: metrics.titleSize }}
            weight="bold"
          >
            {cell.programme.title}
          </Text>

          <Text
            className="text-grey-40"
            numberOfLines={LINE_LIMIT}
            style={{ fontSize: metrics.subtitleSize }}
            weight="semibold"
          >
            {formatProgrammeOnAirWindow(cell.programme, timeZone)}
          </Text>
        </CardText>
      ) : null}
    </Pressable>
  );
}
