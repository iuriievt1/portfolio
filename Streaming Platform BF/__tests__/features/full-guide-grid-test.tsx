import { act, fireEvent, render, within } from "@testing-library/react-native";
import { Animated, Dimensions, ScrollView, StyleSheet } from "react-native";
import type { GuideChannel } from "@/features/full-guide";
import {
  FullGuideGrid,
  getCellLayout,
  getColumnWidth,
  getGuideDays,
  getGuideMetrics,
  getOffsetForTime,
  getOpeningOffset,
  getPixelsPerMinute,
  getRowHeight,
  getRowOffset,
  getTimeAtOffset,
  getTimeline,
  getTimelineWidth,
} from "@/features/full-guide";
import { setWatchedChannelId } from "@/features/live-channels";
import { formatProgrammeOnAirWindow } from "@/utils/programme";

jest.mock("expo-router", () => ({
  // Run the effect like the real hook does while the screen is focused.
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    require("react").useEffect(effect, [effect]);
  },
}));

const PHONE = getGuideMetrics({ isLandscape: false, isTablet: false });
const DAYS = getGuideDays(new Date(2026, 4, 30, 12, 0).getTime());
const DAY = DAYS[0] ?? { endMs: 0, key: "", startMs: 0 };
const TIMELINE = getTimeline(DAYS, DAY.startMs);
const NOW_MS = DAY.startMs + 3_600_000;
const VIEWPORT_WIDTH = Dimensions.get("window").width;
const PIXELS_PER_MINUTE = getPixelsPerMinute(VIEWPORT_WIDTH, PHONE);

function hoursFromStart(hours: number) {
  return DAY.startMs + hours * 3_600_000;
}

function flatten(style: unknown) {
  return StyleSheet.flatten(style) as Record<string, number>;
}

function hourCell(id: string) {
  return {
    endMs: hoursFromStart(2),
    id: `${id}-a`,
    programme: {
      expirationDateTime: new Date(hoursFromStart(2)).toISOString(),
      id: `${id}-a`,
      startDateTime: new Date(hoursFromStart(1)).toISOString(),
      title: `Programme on ${id}`,
    },
    startMs: hoursFromStart(1),
  } as GuideChannel["cells"][number];
}

function channel(id: string, logoUrl?: string): GuideChannel {
  return {
    cells: [hourCell(id)],
    id,
    logoUrl,
    name: `Channel ${id}`,
  } as GuideChannel;
}

const CARD = getCellLayout({
  cell: hourCell("one"),
  metrics: PHONE,
  pixelsPerMinute: PIXELS_PER_MINUTE,
  timeline: TIMELINE,
});
const CARD_AT_STRIP_START = CARD.left - getColumnWidth(PHONE);
const OPENING_X = getOpeningOffset({
  metrics: PHONE,
  nowMs: NOW_MS,
  pixelsPerMinute: PIXELS_PER_MINUTE,
  timeline: TIMELINE,
  timelineWidth: getTimelineWidth(TIMELINE, PIXELS_PER_MINUTE),
  viewportWidth: VIEWPORT_WIDTH,
});

function shiftOf(element: { props: { style: unknown } }) {
  const [shift] = flatten(element.props.style).transform as unknown as [
    { translateX: number },
  ];

  return shift.translateX;
}

function cardBox(element: { props: { style: unknown } }) {
  const style = flatten(element.props.style);
  const left = style.left ?? 0;
  const width = style.width ?? 0;

  return { left, right: left + width, width };
}

function scrollTowards(timeline: { props: unknown }, offsetX: number) {
  fireEvent.scroll(timeline as never, {
    nativeEvent: { contentOffset: { x: offsetX, y: 0 } },
  });
}

function settleAt(timeline: { props: unknown }, offsetX: number) {
  fireEvent(timeline as never, "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: offsetX, y: 0 } },
  });
}

function laterCell(id: string) {
  return {
    endMs: hoursFromStart(3),
    id: `${id}-a`,
    programme: {
      expirationDateTime: new Date(hoursFromStart(3)).toISOString(),
      id: `${id}-a`,
      startDateTime: new Date(hoursFromStart(2)).toISOString(),
      title: `Later on ${id}`,
    },
    startMs: hoursFromStart(2),
  } as GuideChannel["cells"][number];
}

function cellAtHours(id: string, startHour: number, endHour: number) {
  return {
    endMs: hoursFromStart(endHour),
    id,
    programme: {
      expirationDateTime: new Date(hoursFromStart(endHour)).toISOString(),
      id,
      startDateTime: new Date(hoursFromStart(startHour)).toISOString(),
      title: id,
    },
    startMs: hoursFromStart(startHour),
  } as GuideChannel["cells"][number];
}

function briefCell(minutes: number) {
  return {
    endMs: NOW_MS + minutes * 60_000,
    id: "brief-a",
    programme: {
      expirationDateTime: new Date(NOW_MS + minutes * 60_000).toISOString(),
      id: "brief-a",
      startDateTime: new Date(NOW_MS).toISOString(),
      title: `${minutes} minutes`,
    },
    startMs: NOW_MS,
  } as GuideChannel["cells"][number];
}

type GridProps = Parameters<typeof FullGuideGrid>[0];

function renderGrid(overrides: Partial<GridProps> = {}, scrolledTo = 0) {
  const onSelectCell = jest.fn();
  const scrollTo = jest.fn();
  const follow = jest.fn();
  const scrollOffset = new Animated.Value(scrolledTo);
  const settle = jest.fn((offsetX: number) => scrollOffset.setValue(offsetX));
  const scroll = {
    follow,
    readOffset: () => scrolledTo,
    scrollOffset,
    scrollRef: { current: null },
    scrollTo,
    settle,
  };
  const gridElement = (props: Partial<GridProps> = {}) => (
    <FullGuideGrid
      channels={[channel("one", "https://logo"), channel("two")]}
      dayLabel="Today 30 May"
      metrics={PHONE}
      nowMs={NOW_MS}
      onPressDay={jest.fn()}
      onScrollTimeChange={jest.fn()}
      onSelectCell={onSelectCell}
      pixelsPerMinute={PIXELS_PER_MINUTE}
      scroll={scroll}
      selectedCellId={undefined}
      selectedChannelId={undefined}
      timeline={TIMELINE}
      viewportWidth={VIEWPORT_WIDTH}
      {...overrides}
      {...props}
    />
  );
  const view = render(gridElement());

  return {
    ...view,
    follow,
    onSelectCell,
    rerenderGrid: (props: Partial<GridProps>) =>
      view.rerender(gridElement(props)),
    scrollTo,
    settle,
  };
}

describe("<FullGuideGrid />", () => {
  test("stops dead at either end of the week instead of stretching", () => {
    const { getByTestId } = renderGrid();

    expect(getByTestId("full-guide-timeline").props.bounces).toBe(false);
    expect(getByTestId("full-guide-channels").props.bounces).toBe(false);
  });

  test("draws a row per channel over one timeline", () => {
    const { getByTestId } = renderGrid();

    getByTestId("full-guide-timeline");
    getByTestId("guide-row-one");
    getByTestId("guide-row-two");
  });

  test("keeps the channel band over the timeline for every row", () => {
    const { getByTestId } = renderGrid();

    getByTestId("guide-channel-tile-one");
    getByTestId("guide-channel-tile-two");
  });

  test("shows the channel name when the channel has no logo", () => {
    const { getByText, getByTestId, queryByTestId } = renderGrid();

    getByText("Channel two");
    expect(queryByTestId("guide-channel-logo-two")).toBeNull();
    getByTestId("guide-channel-logo-one");
  });

  test("falls back to the channel name when its logo fails", () => {
    const { getByText, getByTestId, queryByTestId } = renderGrid();

    fireEvent(getByTestId("guide-channel-logo-one"), "error", {
      nativeEvent: { error: "failed" },
    });

    getByText("Channel one");
    expect(queryByTestId("guide-channel-logo-one")).toBeNull();
  });

  test("marks the live edge with the clock on a phone", () => {
    const { getByTestId } = renderGrid();

    getByTestId("guide-live-edge");
    getByTestId("guide-live-clock");
  });

  test("prints the live clock over the pointer on a tablet too", () => {
    const { getByTestId } = renderGrid({
      metrics: getGuideMetrics({ isLandscape: false, isTablet: true }),
    });

    getByTestId("guide-timeline-ruler");
    getByTestId("guide-live-clock");
  });

  test("rides the day over the ruler and opens the week from it", () => {
    const onPressDay = jest.fn();
    const { getByTestId, getByText } = renderGrid({ onPressDay });

    getByText("Today 30 May");
    fireEvent.press(getByTestId("guide-day-label"));

    expect(onPressDay).toHaveBeenCalledTimes(1);
  });

  test("draws the column, its tile and the cells at their design sizes", () => {
    const { getByTestId } = renderGrid();
    const column = flatten(getByTestId("guide-channel-column").props.style);
    const slot = flatten(getByTestId("guide-channel-column-one").props.style);
    const tile = flatten(getByTestId("guide-channel-tile-one").props.style);
    const logo = flatten(getByTestId("guide-channel-logo-one").props.style);
    const cell = flatten(getByTestId("guide-cell-one-a").props.style);

    expect([column.left, column.width]).toEqual([0, getColumnWidth(PHONE)]);
    expect([slot.height, slot.paddingLeft]).toEqual([
      getRowHeight(PHONE),
      PHONE.edgeInset,
    ]);
    expect([tile.width, tile.height]).toEqual([
      PHONE.tileWidth,
      PHONE.tileWidth,
    ]);
    expect(getByTestId("guide-row-one").props.style.width).toBe(
      getTimelineWidth(TIMELINE, PIXELS_PER_MINUTE),
    );
    expect(getByTestId("guide-row-one").props.style.height).toBe(
      PHONE.cellHeight + PHONE.rowGap,
    );
    expect([logo.width, logo.height]).toEqual([45, 25]);
    expect(cell.height).toBe(PHONE.cellHeight);
  });

  test("keeps the channel column out of the horizontal timeline, so it never moves sideways", () => {
    const { getByTestId } = renderGrid({}, OPENING_X);
    const timeline = getByTestId("full-guide-timeline");

    scrollTowards(timeline, OPENING_X + VIEWPORT_WIDTH * 12);
    scrollTowards(timeline, OPENING_X + VIEWPORT_WIDTH * 2);

    expect(within(timeline).queryByTestId("guide-channel-column")).toBeNull();
    within(getByTestId("full-guide-channels")).getByTestId(
      "guide-channel-column",
    );
    for (const id of ["one", "two"]) {
      expect(
        flatten(getByTestId(`guide-channel-column-${id}`).props.style)
          .transform,
      ).toBeUndefined();
    }
  });

  test("lines every tile up with its row and draws the column over the timeline", () => {
    const { getByTestId } = renderGrid();
    const drawn = within(getByTestId("full-guide-channels"))
      .getAllByTestId(/^(full-guide-timeline|guide-channel-column)$/)
      .map((element) => element.props.testID);

    expect(drawn).toEqual(["full-guide-timeline", "guide-channel-column"]);
    expect(
      flatten(getByTestId("guide-channel-column-two").props.style).top,
    ).toBe(getRowHeight(PHONE));
    expect(flatten(getByTestId("guide-row-slot-two").props.style).top).toBe(
      getRowHeight(PHONE),
    );
  });

  test("covers the whole strip left of the timeline, from the screen's edge", () => {
    const { getByTestId } = renderGrid();
    const column = flatten(getByTestId("guide-channel-column").props.style);
    const corner = getByTestId("guide-day-corner");

    expect(column.left).toBe(0);
    expect(column.width).toBe(getColumnWidth(PHONE));
    expect(corner.props.className).toContain("left-0");
    expect(flatten(corner.props.style).width).toBe(getColumnWidth(PHONE));
  });

  test("shapes the channel column from the tablet metrics alike", () => {
    for (const metrics of [
      getGuideMetrics({ isLandscape: false, isTablet: true }),
      getGuideMetrics({ isLandscape: true, isTablet: true }),
    ]) {
      const { getByTestId, unmount } = renderGrid({ metrics }, CARD.left - 4);

      expect(
        flatten(getByTestId("guide-channel-column").props.style).width,
      ).toBe(metrics.edgeInset + metrics.tileWidth + metrics.columnGap);
      expect(
        flatten(getByTestId("guide-channel-column-one").props.style)
          .paddingLeft,
      ).toBe(metrics.edgeInset);
      unmount();
    }
  });

  test("mounts only the rows near the screen, while every tile stays", () => {
    const many = Array.from({ length: 30 }, (_row, index) =>
      channel(`row${index}`),
    );
    const { getByTestId, queryByTestId } = renderGrid({ channels: many });

    fireEvent(getByTestId("full-guide-channels"), "layout", {
      nativeEvent: { layout: { height: getRowHeight(PHONE) * 3, width: 400 } },
    });

    getByTestId("guide-row-row0");
    expect(queryByTestId("guide-row-row20")).toBeNull();
    getByTestId("guide-channel-column-row29");
  });

  test("holds skeletons in the rows beyond the mounted ones, which the cards replace as they come near", () => {
    const many = Array.from({ length: 40 }, (_row, index) =>
      channel(`row${index}`),
    );
    const { getByTestId, queryByTestId } = renderGrid(
      { channels: many },
      OPENING_X,
    );
    const rows = getByTestId("full-guide-channels");

    fireEvent(rows, "layout", {
      nativeEvent: { layout: { height: getRowHeight(PHONE) * 3, width: 400 } },
    });

    getByTestId("guide-row-row0");
    expect(queryByTestId("guide-row-skeleton-row0")).toBeNull();
    getByTestId("guide-row-skeleton-cell-row10-a");
    expect(queryByTestId("guide-row-row10")).toBeNull();
    expect(queryByTestId("guide-row-skeleton-row30")).toBeNull();

    fireEvent.scroll(rows, {
      nativeEvent: { contentOffset: { x: 0, y: getRowHeight(PHONE) * 9 } },
    });

    getByTestId("guide-cell-row10-a");
    expect(queryByTestId("guide-row-skeleton-row10")).toBeNull();
    getByTestId("guide-row-skeleton-row20");
  });

  test("gives a title only the width beside the column, so it ends in an ellipsis just when it is cut", () => {
    const { getByTestId } = renderGrid({}, CARD_AT_STRIP_START + 120);

    settleAt(getByTestId("full-guide-timeline"), CARD_AT_STRIP_START + 120);

    const box = flatten(getByTestId("guide-cell-text-one-a-box").props.style);
    const text = flatten(getByTestId("guide-cell-text-one-a").props.style);
    expect(text.width).toBe((box.width ?? 0) - 120);
  });

  test("leaves out the text of a card with too little showing beside the column for a couple of letters", () => {
    const { getByTestId, queryByText } = renderGrid(
      {},
      CARD_AT_STRIP_START + CARD.width - 40,
    );

    settleAt(
      getByTestId("full-guide-timeline"),
      CARD_AT_STRIP_START + CARD.width - 40,
    );

    getByTestId("guide-cell-one-a");
    expect(queryByText("Programme on one")).toBeNull();
  });

  test("gives a title the card's whole text width while the card is clear of the column", () => {
    const { getByTestId } = renderGrid({}, CARD_AT_STRIP_START - 40);

    settleAt(getByTestId("full-guide-timeline"), CARD_AT_STRIP_START - 40);

    const box = flatten(getByTestId("guide-cell-text-one-a-box").props.style);
    const text = flatten(getByTestId("guide-cell-text-one-a").props.style);
    expect(text.width).toBe(box.width);
  });

  test("repopulates cells after rapid right and left jumps", () => {
    const fast = channel("fast");
    const near = cellAtHours("near", 1, 2);
    const far = cellAtHours("far", 14, 15);
    fast.cells = [near, far];
    const { getByTestId, queryByTestId } = renderGrid({ channels: [fast] });
    const timeline = getByTestId("full-guide-timeline");
    const farOffset = getCellLayout({
      cell: far,
      metrics: PHONE,
      pixelsPerMinute: PIXELS_PER_MINUTE,
      timeline: TIMELINE,
    }).left;

    getByTestId("guide-cell-near");
    expect(queryByTestId("guide-cell-far")).toBeNull();

    scrollTowards(timeline, farOffset);
    getByTestId("guide-cell-far");

    scrollTowards(timeline, CARD.left);
    getByTestId("guide-cell-near");
  });

  describe("jumping a long way", () => {
    // Every row holds a card near the opening, one ending 0.8 screens behind the jump, and one at the jump.
    function renderJumpGrid() {
      const farHour = 14;
      const backHour =
        farHour - (0.8 * VIEWPORT_WIDTH) / (60 * PIXELS_PER_MINUTE);
      const many = Array.from({ length: 30 }, (_row, index) => {
        const row = channel(`row${index}`);
        row.cells = [
          cellAtHours(`row${index}-near`, 1, 2),
          cellAtHours(`row${index}-back`, backHour - 0.25, backHour),
          cellAtHours(`row${index}-far`, farHour, farHour + 1),
        ];

        return row;
      });
      const view = renderGrid({ channels: many }, OPENING_X);

      fireEvent(view.getByTestId("full-guide-channels"), "layout", {
        nativeEvent: {
          layout: { height: getRowHeight(PHONE) * 3, width: 400 },
        },
      });
      view.getByTestId("guide-cell-row5-near");
      expect(view.queryByTestId("guide-cell-row5-far")).toBeNull();

      return {
        ...view,
        farOffset: getOffsetForTime({
          pixelsPerMinute: PIXELS_PER_MINUTE,
          timeMs: hoursFromStart(farHour),
          timeline: TIMELINE,
        }),
      };
    }

    test("draws a jump made in code as at rest, in the rows off screen and with no lean in the rows on it", () => {
      const { farOffset, getByTestId, queryByTestId } = renderJumpGrid();

      // The day picker's jump: a scroll event with no drag before it and no momentum after it.
      scrollTowards(getByTestId("full-guide-timeline"), farOffset);

      getByTestId("guide-cell-row0-far");
      getByTestId("guide-cell-row0-back");
      getByTestId("guide-cell-row5-far");
      expect(queryByTestId("guide-cell-row5-near")).toBeNull();
    });

    test("still leans the rows on screen ahead of a fling under a finger, and leaves the rest for when it stops", () => {
      const { farOffset, getByTestId, queryByTestId } = renderJumpGrid();
      const timeline = getByTestId("full-guide-timeline");

      fireEvent(timeline, "scrollBeginDrag", {
        nativeEvent: { contentOffset: { x: OPENING_X, y: 0 } },
      });
      scrollTowards(timeline, farOffset);

      getByTestId("guide-cell-row0-far");
      expect(queryByTestId("guide-cell-row0-back")).toBeNull();
      expect(queryByTestId("guide-cell-row5-far")).toBeNull();

      settleAt(timeline, farOffset);

      getByTestId("guide-cell-row0-back");
      getByTestId("guide-cell-row5-far");
    });
  });

  test("starts a programme's text clear of the column once its card has slid under", () => {
    const { getByTestId } = renderGrid({}, CARD_AT_STRIP_START + 120);

    settleAt(getByTestId("full-guide-timeline"), CARD_AT_STRIP_START + 120);

    expect(shiftOf(getByTestId("guide-cell-text-one-a"))).toBe(120);
  });

  test("leaves a programme's text in place while its card is clear of the column", () => {
    const { getByTestId } = renderGrid({}, CARD_AT_STRIP_START - 40);

    settleAt(getByTestId("full-guide-timeline"), CARD_AT_STRIP_START - 40);

    expect(shiftOf(getByTestId("guide-cell-text-one-a"))).toBe(0);
  });

  test("draws cards still, with nothing riding the native scroll", () => {
    const { getByTestId, queryByTestId } = renderGrid();

    expect(queryByTestId("guide-cell-start-edge-one-a")).toBeNull();
    expect(queryByTestId("guide-cell-end-edge-one-a")).toBeNull();
    expect(typeof shiftOf(getByTestId("guide-cell-text-one-a"))).toBe("number");
  });

  test("still names a five-minute programme, at the card's true width", () => {
    const brief = channel("brief");
    const cell = briefCell(5);
    brief.cells = [cell] as GuideChannel["cells"];

    const { getByTestId, getByText } = renderGrid({ channels: [brief] });
    const card = cardBox(getByTestId("guide-cell-brief-a"));

    getByText("5 minutes");
    getByTestId("guide-cell-text-brief-a");
    expect(card.width).toBeCloseTo(
      getCellLayout({
        cell,
        metrics: PHONE,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        timeline: TIMELINE,
      }).width,
    );
  });

  test("keeps a short programme's text clear of both closed ends", () => {
    const brief = channel("brief");
    brief.cells = [briefCell(4)] as GuideChannel["cells"];

    const { getByTestId, getByText } = renderGrid({ channels: [brief] });
    const card = cardBox(getByTestId("guide-cell-brief-a"));
    const box = flatten(getByTestId("guide-cell-text-brief-a-box").props.style);

    getByText("4 minutes");
    expect(box.left).toBe(10);
    expect(card.width - 4 - (box.left ?? 0) - (box.width ?? 0)).toBeCloseTo(10);
  });

  test("leaves the mark under the live clock to the clock", () => {
    const onTheHalfHour = DAY.startMs + 10.5 * 3_600_000;
    const { getAllByText } = renderGrid({ nowMs: onTheHalfHour });

    expect(getAllByText("10:30")).toHaveLength(1);
  });

  test("reports the programme a viewer picks", () => {
    const { getByTestId, onSelectCell } = renderGrid();

    fireEvent.press(getByTestId("guide-cell-one-a"));

    expect(onSelectCell).toHaveBeenCalledWith("one-a");
  });

  test("takes a programme on air to the live edge from wherever it is picked", () => {
    for (const scrolledTo of [CARD.left, OPENING_X + 2000]) {
      const { getByTestId, scrollTo } = renderGrid({}, scrolledTo);

      fireEvent.press(getByTestId("guide-cell-one-a"));

      expect(scrollTo).toHaveBeenCalledWith(OPENING_X, { animated: true });
    }
  });

  test("dims the title of a programme that is not on air", () => {
    const later = channel("later");
    later.cells = [laterCell("later")] as GuideChannel["cells"];

    const { getByText } = renderGrid(
      { channels: [channel("one"), later] },
      OPENING_X,
    );

    expect(getByText("Programme on one").props.className).not.toContain(
      "opacity-60",
    );
    expect(getByText("Later on later").props.className).toContain("opacity-60");
    expect(
      getByText(formatProgrammeOnAirWindow(laterCell("later").programme)).props
        .className,
    ).toContain("text-grey-40");
  });

  test("takes a programme still to come to its own start", () => {
    const later = channel("later");
    const cell = laterCell("later");
    later.cells = [cell] as GuideChannel["cells"];
    const start =
      getCellLayout({
        cell,
        metrics: PHONE,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        timeline: TIMELINE,
      }).left - getColumnWidth(PHONE);

    const { getByTestId, scrollTo } = renderGrid(
      { channels: [later] },
      start - 100,
    );

    fireEvent.press(getByTestId("guide-cell-later-a"));

    expect(scrollTo).toHaveBeenCalledWith(start, { animated: true });
  });

  test("keeps the viewer's place when the picked card began long before", () => {
    const gap = channel("gap");
    gap.cells = [
      {
        ...hourCell("gap"),
        endMs: NOW_MS - 300_000,
        startMs: hoursFromStart(0),
      },
    ] as GuideChannel["cells"];

    const { getByTestId, scrollTo } = renderGrid(
      { channels: [gap] },
      OPENING_X + 300,
    );

    fireEvent.press(getByTestId("guide-cell-gap-a"));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  test("stays where it is when the picked programme is already there", () => {
    const { getByTestId, scrollTo } = renderGrid({}, OPENING_X);

    fireEvent.press(getByTestId("guide-cell-one-a"));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  test("hands every scroll frame to the timeline's motion", () => {
    const { follow, getByTestId } = renderGrid({}, 500);
    const timeline = getByTestId("full-guide-timeline");

    scrollTowards(timeline, 540);
    scrollTowards(timeline, 460);

    expect(follow.mock.calls).toEqual([[540], [460]]);
  });

  test("draws the strip where momentum leaves it", () => {
    const { getByTestId } = renderGrid({}, CARD_AT_STRIP_START);

    settleAt(getByTestId("full-guide-timeline"), CARD_AT_STRIP_START + 60);

    expect(shiftOf(getByTestId("guide-cell-text-one-a"))).toBe(60);
  });

  test("lands on a release without speed, and lets a flick run on", () => {
    const releaseAt = (velocityX: number) => {
      const view = renderGrid({}, CARD_AT_STRIP_START);

      fireEvent(view.getByTestId("full-guide-timeline"), "scrollEndDrag", {
        nativeEvent: {
          contentOffset: { x: CARD_AT_STRIP_START + 60, y: 0 },
          velocity: { x: velocityX, y: 0 },
        },
      });

      const shift = shiftOf(view.getByTestId("guide-cell-text-one-a"));
      view.unmount();

      return shift;
    };

    expect(releaseAt(0)).toBe(60);
    expect(releaseAt(1.5)).not.toBe(60);
  });

  test("keeps the moment at the strip's edge when the scale changes", () => {
    const { getByTestId, rerenderGrid, scrollTo } = renderGrid({}, 500);

    fireEvent(getByTestId("full-guide-channels"), "layout", {
      nativeEvent: { layout: { height: 600, width: VIEWPORT_WIDTH } },
    });

    const keptMs = getTimeAtOffset({
      offsetX: 500,
      pixelsPerMinute: PIXELS_PER_MINUTE,
      timeline: TIMELINE,
    });
    const widerViewport = VIEWPORT_WIDTH + 300;
    const widerPixelsPerMinute = getPixelsPerMinute(widerViewport, PHONE);

    rerenderGrid({
      pixelsPerMinute: widerPixelsPerMinute,
      viewportWidth: widerViewport,
    });
    fireEvent(
      getByTestId("full-guide-timeline"),
      "contentSizeChange",
      getTimelineWidth(TIMELINE, widerPixelsPerMinute),
      600,
    );

    expect(scrollTo).toHaveBeenLastCalledWith(
      getOffsetForTime({
        pixelsPerMinute: widerPixelsPerMinute,
        timeMs: keptMs,
        timeline: TIMELINE,
      }),
    );
  });

  test("marks the selected programme", () => {
    const { getByTestId } = renderGrid({
      selectedCellId: "one-a",
      selectedChannelId: "one",
    });

    expect(
      getByTestId("guide-cell-one-a").props.accessibilityState.selected,
    ).toBe(true);
  });

  test("brings the watched channel's row into view on return from the player", () => {
    const scrollTo = jest
      .spyOn(ScrollView.prototype, "scrollTo")
      .mockImplementation(() => undefined);
    const channels = Array.from({ length: 12 }, (_, index) =>
      channel(`channel-${index}`),
    );
    const { getByTestId } = renderGrid({ channels });

    fireEvent(getByTestId("full-guide-channels"), "layout", {
      nativeEvent: { layout: { height: 300, width: VIEWPORT_WIDTH } },
    });

    act(() => {
      setWatchedChannelId("channel-9");
    });

    expect(scrollTo).toHaveBeenCalledWith({
      animated: true,
      y: getRowOffset({
        index: 9,
        listHeight: 300,
        offsetY: 0,
        rowCount: 12,
        rowHeight: getRowHeight(PHONE),
      }),
    });

    scrollTo.mockRestore();
  });

  test("hands the selection to its own row only", () => {
    const { getByTestId } = renderGrid({
      selectedCellId: "two-a",
      selectedChannelId: "one",
    });

    expect(
      getByTestId("guide-cell-two-a").props.accessibilityState.selected,
    ).toBe(false);
  });

  test("holds the places beyond the drawn cards with skeletons, on the rows on screen", () => {
    const busy = (id: string): GuideChannel => ({
      ...channel(id),
      cells: Array.from({ length: 24 }, (_cell, hour) =>
        cellAtHours(`${id}-${hour}`, hour, hour + 1),
      ),
    });
    const { getByTestId, queryAllByTestId } = renderGrid({
      channels: [busy("near"), busy("mid"), busy("far"), busy("off")],
    });

    fireEvent(getByTestId("full-guide-channels"), "layout", {
      nativeEvent: {
        layout: { height: PHONE.cellHeight + PHONE.rowGap, width: 400 },
      },
    });

    const skeletonsOn = (id: string) =>
      queryAllByTestId(new RegExp(`^guide-cell-skeleton-${id}-`)).length;

    expect(skeletonsOn("near")).toBeGreaterThan(0);
    expect(skeletonsOn("off")).toBe(0);
  });

  test("lets a moving timeline run only as far as its skeletons, and the whole week at rest", () => {
    const { getByTestId } = renderGrid({}, OPENING_X);
    const timeline = getByTestId("full-guide-timeline");
    const contentWidth = () =>
      flatten(getByTestId("full-guide-timeline-content").props.style).width;

    expect(contentWidth()).toBe(getTimelineWidth(TIMELINE, PIXELS_PER_MINUTE));

    fireEvent(timeline, "scrollBeginDrag", {
      nativeEvent: { contentOffset: { x: OPENING_X, y: 0 } },
    });

    expect(contentWidth()).toBeLessThan(
      getTimelineWidth(TIMELINE, PIXELS_PER_MINUTE),
    );

    settleAt(timeline, OPENING_X);

    expect(contentWidth()).toBe(getTimelineWidth(TIMELINE, PIXELS_PER_MINUTE));
  });
});
