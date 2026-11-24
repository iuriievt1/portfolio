import type { GuideCell } from "@/features/full-guide";
import {
  clampOffset,
  getCellLayout,
  getCentredOffset,
  getColumnWidth,
  getGuideDays,
  getGuideMetrics,
  getHiddenWidth,
  getLookbackStartMs,
  getOffsetForTime,
  getOnScreenCellLayouts,
  getOpeningOffset,
  getPinnedFadeRange,
  getPixelsPerMinute,
  getReachableWidth,
  getRenderWindow,
  getRowOffset,
  getSelectionOffset,
  getSkeletonCellLayouts,
  getSkeletonRows,
  getTimeAtOffset,
  getTimeline,
  getTimelineWidth,
  getTrackedRows,
  getVisibleCellLayouts,
  getVisibleCells,
  isNearColumn,
  LOOKBACK_MS,
} from "@/features/full-guide";

const DAYS = getGuideDays(new Date(2026, 4, 30, 12, 0).getTime());
const DAY = DAYS[0] ?? { endMs: 0, key: "", startMs: 0 };
const TIMELINE = getTimeline(DAYS, DAY.startMs);
const PHONE = getGuideMetrics({ isLandscape: false, isTablet: false });
const PORTRAIT = getGuideMetrics({ isLandscape: false, isTablet: true });
const LANDSCAPE = getGuideMetrics({ isLandscape: true, isTablet: true });
const PIXELS_PER_MINUTE = 4;
const VIEWPORT_WIDTH = 375;
const TIMELINE_WIDTH = getTimelineWidth(TIMELINE, PIXELS_PER_MINUTE);
function openingOffset(metrics: typeof PHONE, nowMs: number) {
  return getOpeningOffset({
    metrics,
    nowMs,
    pixelsPerMinute: PIXELS_PER_MINUTE,
    timeline: TIMELINE,
    timelineWidth: TIMELINE_WIDTH,
    viewportWidth: VIEWPORT_WIDTH,
  });
}

function cellAt(startHours: number, endHours: number): GuideCell {
  const startMs = DAY.startMs + startHours * 3_600_000;

  return {
    endMs: DAY.startMs + endHours * 3_600_000,
    id: `${startHours}-${endHours}`,
    programme: {
      contentType: "programme",
      id: `${startHours}-${endHours}`,
      startDateTime: new Date(startMs).toISOString(),
      title: "Programme",
    } as GuideCell["programme"],
    startMs,
  };
}

describe("guide layout", () => {
  test("draws each shape at its own design metrics", () => {
    expect([PHONE.edgeInset, PORTRAIT.edgeInset, LANDSCAPE.edgeInset]).toEqual([
      16, 40, 40,
    ]);
    expect([PHONE.tileWidth, PORTRAIT.tileWidth, LANDSCAPE.tileWidth]).toEqual([
      80, 80, 124,
    ]);
    expect([
      PHONE.cellHeight,
      PORTRAIT.cellHeight,
      LANDSCAPE.cellHeight,
    ]).toEqual([80, 80, 87]);
    expect([PHONE.cellGap, PORTRAIT.cellGap, LANDSCAPE.cellGap]).toEqual([
      10, 10, 10,
    ]);
    expect([PHONE.columnGap, PORTRAIT.columnGap, LANDSCAPE.columnGap]).toEqual([
      8, 16, 16,
    ]);
    expect([PHONE.titleSize, PORTRAIT.titleSize, LANDSCAPE.titleSize]).toEqual([
      16, 18, 18,
    ]);
    expect([
      PHONE.subtitleSize,
      PORTRAIT.subtitleSize,
      LANDSCAPE.subtitleSize,
    ]).toEqual([14, 12, 12]);
    expect([PHONE.textGap, PORTRAIT.textGap, LANDSCAPE.textGap]).toEqual([
      6, 6, 4,
    ]);
    expect([PHONE.daySize, PORTRAIT.daySize, LANDSCAPE.daySize]).toEqual([
      12, 13, 13,
    ]);
    expect([PHONE.rulerSize, PORTRAIT.rulerSize, LANDSCAPE.rulerSize]).toEqual([
      12, 15, 15,
    ]);
  });

  test("spaces the hero's blocks as the guide's own designs ask", () => {
    expect([
      PHONE.heroMetadataGap,
      PORTRAIT.heroMetadataGap,
      LANDSCAPE.heroMetadataGap,
    ]).toEqual([16, 10, 10]);
    expect([
      PHONE.heroTitleGap,
      PORTRAIT.heroTitleGap,
      LANDSCAPE.heroTitleGap,
    ]).toEqual([16, 16, 16]);
    expect([
      PHONE.heroSynopsisGap,
      PORTRAIT.heroSynopsisGap,
      LANDSCAPE.heroSynopsisGap,
    ]).toEqual([16, 16, 16]);
    expect([
      PHONE.heroButtonWidth,
      PORTRAIT.heroButtonWidth,
      LANDSCAPE.heroButtonWidth,
    ]).toEqual([undefined, 174, 264]);
    expect([PHONE.heroGap, PORTRAIT.heroGap, LANDSCAPE.heroGap]).toEqual([
      0, 32, 49.5,
    ]);
  });

  test("keeps the pinned column wide enough for the tile it holds", () => {
    expect(getColumnWidth(PHONE)).toBe(16 + 80 + 8);
    expect(getColumnWidth(PORTRAIT)).toBe(40 + 80 + 16);
    expect(getColumnWidth(LANDSCAPE)).toBe(40 + 124 + 16);
  });

  test("leaves the pointer sitting on the grid's top edge", () => {
    expect(
      PORTRAIT.headerHeight - PORTRAIT.pointerHeight - PORTRAIT.dayLabelHeight,
    ).toBeCloseTo(29);
    expect(
      LANDSCAPE.headerHeight -
        LANDSCAPE.pointerHeight -
        LANDSCAPE.dayLabelHeight,
    ).toBeCloseTo(4);
  });

  test("draws the whole week when asked from its first day", () => {
    expect(getTimeline(DAYS, DAY.startMs)).toEqual({
      endMs: DAYS.at(-1)?.endMs,
      startMs: DAY.startMs,
    });
  });

  test("reads a moment back off its offset", () => {
    const timeMs = DAY.startMs + 7.5 * 3_600_000;
    const offsetX = getOffsetForTime({
      pixelsPerMinute: PIXELS_PER_MINUTE,
      timeMs,
      timeline: TIMELINE,
    });

    expect(
      getTimeAtOffset({
        offsetX,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        timeline: TIMELINE,
      }),
    ).toBe(timeMs);
  });

  test("puts a moment in the middle of the viewport", () => {
    const timeMs = DAY.startMs + 7.5 * 3_600_000;

    expect(
      getCentredOffset({
        pixelsPerMinute: PIXELS_PER_MINUTE,
        timeMs,
        timeline: TIMELINE,
        viewportWidth: VIEWPORT_WIDTH,
      }),
    ).toBe(7.5 * 60 * PIXELS_PER_MINUTE - VIEWPORT_WIDTH / 2);
  });

  test("draws a screen either side of the viewport while the timeline rests", () => {
    expect(
      getRenderWindow({ scrollX: 1000, viewportWidth: VIEWPORT_WIDTH }),
    ).toEqual({
      fromX: 1000 - VIEWPORT_WIDTH,
      toX: 1000 + 2 * VIEWPORT_WIDTH,
    });
  });

  test("runs the drawn stretch ahead of a moving timeline, in either direction", () => {
    expect(
      getRenderWindow({
        heading: 1,
        scrollX: 1000,
        viewportWidth: VIEWPORT_WIDTH,
      }),
    ).toEqual({
      fromX: 1000 - 0.5 * VIEWPORT_WIDTH,
      toX: 1000 + 2.5 * VIEWPORT_WIDTH,
    });
    expect(
      getRenderWindow({
        heading: -1,
        scrollX: 1000,
        viewportWidth: VIEWPORT_WIDTH,
      }),
    ).toEqual({
      fromX: 1000 - 1.5 * VIEWPORT_WIDTH,
      toX: 1000 + 1.5 * VIEWPORT_WIDTH,
    });
  });

  test("begins the week where it is asked to, never before it", () => {
    const fromMs = DAY.startMs + 5 * 3_600_000;

    expect(getTimeline(DAYS, fromMs).startMs).toBe(fromMs);
    expect(getTimeline(DAYS, DAY.startMs - 3_600_000).startMs).toBe(
      DAY.startMs,
    );
    expect(getTimelineWidth(getTimeline(DAYS, fromMs), PIXELS_PER_MINUTE)).toBe(
      TIMELINE_WIDTH - 5 * 60 * PIXELS_PER_MINUTE,
    );
  });

  test("reaches half an hour behind the opening, the column's stretch included", () => {
    const openedAtMs = DAY.startMs + 12 * 3_600_000;
    const columnMinutes = getColumnWidth(PHONE) / PIXELS_PER_MINUTE;
    const startMs = getLookbackStartMs({
      metrics: PHONE,
      openedAtMs,
      pixelsPerMinute: PIXELS_PER_MINUTE,
    });

    expect(startMs).toBe(openedAtMs - LOOKBACK_MS - columnMinutes * 60_000);
    expect(startMs + (getColumnWidth(PHONE) / PIXELS_PER_MINUTE) * 60_000).toBe(
      openedAtMs - LOOKBACK_MS,
    );
  });

  test("holds an offset inside the reachable week", () => {
    const bounds = {
      timelineWidth: TIMELINE_WIDTH,
      viewportWidth: VIEWPORT_WIDTH,
    };

    expect(clampOffset({ offset: -500, ...bounds })).toBe(0);
    expect(clampOffset({ offset: 500, ...bounds })).toBe(500);
    expect(clampOffset({ offset: TIMELINE_WIDTH, ...bounds })).toBe(
      TIMELINE_WIDTH - VIEWPORT_WIDTH,
    );
  });

  test("scales the whole week to the timeline width", () => {
    expect(getTimelineWidth(TIMELINE, PIXELS_PER_MINUTE)).toBe(7 * 24 * 60 * 4);
  });

  test("fills the strip beside the channel column with one hour", () => {
    const phoneWidth = 375;

    expect(getPixelsPerMinute(phoneWidth, PHONE) * 60).toBe(
      phoneWidth - getColumnWidth(PHONE),
    );
    expect(getPixelsPerMinute(834, PHONE)).toBeGreaterThan(
      getPixelsPerMinute(phoneWidth, PHONE),
    );
  });

  test("places a moment by how far it sits into the week", () => {
    expect(
      getOffsetForTime({
        pixelsPerMinute: PIXELS_PER_MINUTE,
        timeMs: DAY.startMs + 90 * 60_000,
        timeline: TIMELINE,
      }),
    ).toBe(360);
  });

  test("sizes a cell by its own duration", () => {
    expect(
      getCellLayout({
        cell: cellAt(10, 11),
        metrics: PHONE,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        timeline: TIMELINE,
      }),
    ).toEqual({ left: 2400, width: 240 - PHONE.cellGap });
  });

  test("clips a cell that runs past the end of the week", () => {
    const overnight: GuideCell = {
      ...cellAt(23, 23),
      endMs: TIMELINE.endMs + 3_600_000,
      startMs: TIMELINE.endMs - 3_600_000,
    };

    const { left, width } = getCellLayout({
      cell: overnight,
      metrics: PHONE,
      pixelsPerMinute: PIXELS_PER_MINUTE,
      timeline: TIMELINE,
    });

    expect(left + width).toBe(
      getTimelineWidth(TIMELINE, PIXELS_PER_MINUTE) - PHONE.cellGap,
    );
  });

  test("leaves out a cell too short to keep its spacing", () => {
    const brief: GuideCell = {
      ...cellAt(10, 10),
      endMs: DAY.startMs + 10 * 3_600_000 + 30_000,
    };

    const visible = getVisibleCells({
      cells: [brief],
      metrics: PHONE,
      pixelsPerMinute: PIXELS_PER_MINUTE,
      scrollX: getCellLayout({
        cell: brief,
        metrics: PHONE,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        timeline: TIMELINE,
      }).left,
      timeline: TIMELINE,
      viewportWidth: 375,
    });

    expect(visible).toEqual([]);
  });

  test("leaves exactly the design gap between neighbouring cells", () => {
    const line = [cellAt(21, 21.5), cellAt(21.5, 21.75), cellAt(21.75, 22)];

    const layouts = line.map((cell) =>
      getCellLayout({
        cell,
        metrics: PHONE,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        timeline: TIMELINE,
      }),
    );

    layouts.forEach((layout, index) => {
      const next = layouts[index + 1];

      if (next) {
        expect(next.left - (layout.left + layout.width)).toBeCloseTo(
          PHONE.cellGap,
        );
      }
    });
  });

  test("carves the gap out of every drawn cell", () => {
    const hour = cellAt(10, 11);

    const { width } = getCellLayout({
      cell: hour,
      metrics: PHONE,
      pixelsPerMinute: PIXELS_PER_MINUTE,
      timeline: TIMELINE,
    });

    expect(width).toBe(60 * PIXELS_PER_MINUTE - PHONE.cellGap);
  });

  test("opens on the live edge, with the clock clear of the column", () => {
    const nowMs = DAY.startMs + 10 * 3_600_000;
    const nowLeft = getOffsetForTime({
      pixelsPerMinute: PIXELS_PER_MINUTE,
      timeMs: nowMs,
      timeline: TIMELINE,
    });
    const { inputRange } = getPinnedFadeRange(
      nowLeft - PHONE.clockWidth / 2,
      PHONE,
    );

    const offset = openingOffset(PHONE, nowMs);
    expect(offset).toBe(inputRange[0]);
    expect(nowLeft - offset).toBeGreaterThan(0);
    expect(nowLeft - offset).toBeLessThan(VIEWPORT_WIDTH);
  });

  test("leads by the clock the shape draws, wider on a tablet", () => {
    const nowMs = DAY.startMs + 10 * 3_600_000;

    const leadOf = (metrics: typeof PHONE) =>
      getOffsetForTime({
        pixelsPerMinute: PIXELS_PER_MINUTE,
        timeMs: nowMs,
        timeline: TIMELINE,
      }) -
      openingOffset(metrics, nowMs) -
      getColumnWidth(metrics);
    expect(leadOf(PORTRAIT) - leadOf(PHONE)).toBeCloseTo(
      (PORTRAIT.clockWidth - PHONE.clockWidth) / 2,
    );
  });

  test("never opens before the start of the week", () => {
    expect(openingOffset(PHONE, TIMELINE.startMs)).toBe(0);
  });

  test("never opens past the end of the week", () => {
    expect(openingOffset(PHONE, TIMELINE.endMs)).toBe(
      TIMELINE_WIDTH - VIEWPORT_WIDTH,
    );
  });

  describe("getSelectionOffset", () => {
    const nowMs = DAY.startMs + 10 * 3_600_000;
    const liveEdge = openingOffset(PHONE, nowMs);

    function startOf(hours: number) {
      return hours * 60 * PIXELS_PER_MINUTE - getColumnWidth(PHONE);
    }

    function selectionOffset(cell: GuideCell, offsetX: number) {
      return getSelectionOffset({
        cell,
        metrics: PHONE,
        nowMs,
        offsetX,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        timeline: TIMELINE,
        timelineWidth: TIMELINE_WIDTH,
        viewportWidth: VIEWPORT_WIDTH,
      });
    }

    test("takes a programme on air to the live edge, not to its start", () => {
      expect(selectionOffset(cellAt(8, 12), liveEdge)).toBe(liveEdge);
    });

    test("brings a programme on air back to the live edge from anywhere", () => {
      expect(selectionOffset(cellAt(8, 12), liveEdge + 2000)).toBe(liveEdge);
      expect(selectionOffset(cellAt(8, 12), 0)).toBe(liveEdge);
    });

    test("takes a programme still to come to its own start", () => {
      expect(selectionOffset(cellAt(14, 15), startOf(14) - 150)).toBe(
        startOf(14),
      );
    });

    test("brings a programme that began within a strip back to the edge", () => {
      expect(selectionOffset(cellAt(8, 9), startOf(9))).toBe(startOf(8));
    });

    test("keeps the viewer's place when the programme began further back", () => {
      expect(selectionOffset(cellAt(2, 3), liveEdge)).toBe(liveEdge);
    });

    test("never leaves the week it draws", () => {
      expect(selectionOffset(cellAt(0, 1), 100)).toBe(0);
    });
  });

  describe("getRowOffset", () => {
    const ROW_HEIGHT = 90;
    const LIST_HEIGHT = ROW_HEIGHT * 4;

    function rowOffset(index: number, offsetY: number) {
      return getRowOffset({
        index,
        listHeight: LIST_HEIGHT,
        offsetY,
        rowCount: 10,
        rowHeight: ROW_HEIGHT,
      });
    }

    test("leaves a row with air either side of it alone", () => {
      expect(rowOffset(2, 0)).toBeNull();
    });

    test("brings a row below the fold up, with the next one under it", () => {
      expect(rowOffset(5, 0)).toBe(ROW_HEIGHT * 7 - LIST_HEIGHT);
    });

    test("brings a row above the fold down, with the one before it in sight", () => {
      expect(rowOffset(4, ROW_HEIGHT * 5)).toBe(ROW_HEIGHT * 3);
    });

    test("never scrolls past the first or the last row", () => {
      expect(rowOffset(0, ROW_HEIGHT * 3)).toBe(0);
      expect(rowOffset(9, 0)).toBe(ROW_HEIGHT * 10 - LIST_HEIGHT);
    });
  });

  describe("skeletons", () => {
    const hourCells = Array.from({ length: 48 }, (_cell, index) => ({
      cell: { id: `hour-${index}` } as GuideCell,
      layout: { left: index * VIEWPORT_WIDTH, width: VIEWPORT_WIDTH - 10 },
    }));
    const ids = (cells: { cell: GuideCell }[]) =>
      cells.map(({ cell }) => cell.id);

    test("hold the places either side of the drawn cards, never under them", () => {
      const scrollX = 10 * VIEWPORT_WIDTH;
      const drawn = ids(
        getVisibleCellLayouts({
          cells: hourCells,
          scrollX,
          viewportWidth: VIEWPORT_WIDTH,
        }),
      );
      const skeletons = ids(
        getSkeletonCellLayouts({
          cells: hourCells,
          scrollX,
          viewportWidth: VIEWPORT_WIDTH,
        }),
      );

      expect(drawn).toEqual(["hour-9", "hour-10", "hour-11", "hour-12"]);
      expect(skeletons).toEqual([
        "hour-6",
        "hour-7",
        "hour-8",
        "hour-13",
        "hour-14",
        "hour-15",
      ]);
    });

    test("let a moving timeline run only as far as the last skeleton", () => {
      expect(
        getReachableWidth({
          scrollX: 1000,
          timelineWidth: 100_000,
          viewportWidth: VIEWPORT_WIDTH,
        }),
      ).toBe(1000 + 5 * VIEWPORT_WIDTH);
      expect(
        getReachableWidth({
          scrollX: 1000,
          timelineWidth: 2000,
          viewportWidth: VIEWPORT_WIDTH,
        }),
      ).toBe(2000);
    });
  });

  describe("isNearColumn", () => {
    test("follows the scroll for a card the timeline can carry under the column", () => {
      const layout = {
        left: getColumnWidth(PHONE) + 1000 + VIEWPORT_WIDTH,
        width: 200,
      };

      expect(
        isNearColumn({
          layout,
          metrics: PHONE,
          scrollX: 1000,
          viewportWidth: VIEWPORT_WIDTH,
        }),
      ).toBe(true);
      expect(
        isNearColumn({
          layout,
          metrics: PHONE,
          scrollX: 1000 - 3 * VIEWPORT_WIDTH,
          viewportWidth: VIEWPORT_WIDTH,
        }),
      ).toBe(false);
    });
  });

  describe("getSkeletonRows", () => {
    test("reaches four screens of rows either side, within the list", () => {
      expect(
        getSkeletonRows({
          listHeight: 450,
          offsetY: 90 * 30,
          rowCount: 100,
          rowHeight: 90,
        }),
      ).toEqual({ first: 10, last: 55 });
      expect(
        getSkeletonRows({
          listHeight: 450,
          offsetY: 0,
          rowCount: 12,
          rowHeight: 90,
        }),
      ).toEqual({ first: 0, last: 11 });
    });
  });

  describe("getOnScreenCellLayouts", () => {
    test("keeps only the cells reaching into the viewport", () => {
      const cells = [0, 400, 800, 1200].map((left) => ({
        cell: { id: `at-${left}` } as GuideCell,
        layout: { left, width: 390 },
      }));

      expect(
        getOnScreenCellLayouts({ cells, scrollX: 500, viewportWidth: 375 }).map(
          ({ cell }) => cell.id,
        ),
      ).toEqual(["at-400", "at-800"]);
    });
  });

  describe("getTrackedRows", () => {
    test("tracks the rows on screen and one either side", () => {
      expect(
        getTrackedRows({ listHeight: 450, offsetY: 900, rowHeight: 90 }),
      ).toEqual({ first: 9, last: 15 });
    });
  });

  describe("getHiddenWidth", () => {
    const layout = { left: 1000, width: 300 };
    const stripStart = layout.left - getColumnWidth(PHONE);

    test("hides nothing of a card still clear of the column", () => {
      expect(getHiddenWidth({ layout, metrics: PHONE, scrollX: 0 })).toBe(0);
      expect(
        getHiddenWidth({ layout, metrics: PHONE, scrollX: stripStart }),
      ).toBe(0);
    });

    test("measures how far a card has slid under the column", () => {
      expect(
        getHiddenWidth({ layout, metrics: PHONE, scrollX: stripStart + 120 }),
      ).toBe(120);
    });

    test("holds at the card's width once it has gone under for good", () => {
      expect(
        getHiddenWidth({ layout, metrics: PHONE, scrollX: stripStart + 5000 }),
      ).toBe(layout.width);
    });
  });

  describe("getPinnedFadeRange", () => {
    test("fades a label out as its left edge reaches the pinned column", () => {
      const { extrapolate, inputRange, outputRange } = getPinnedFadeRange(
        500,
        PHONE,
      );

      expect(extrapolate).toBe("clamp");
      expect(outputRange).toEqual([1, 0]);
      expect(inputRange[1]).toBe(500 - getColumnWidth(PHONE));
      expect(inputRange[0]).toBeLessThan(inputRange[1] as number);
    });

    test("keeps a label at the timeline's start out of the way", () => {
      const { inputRange } = getPinnedFadeRange(0, PHONE);

      expect(inputRange[0]).toBeLessThan(0);
    });
  });
});
