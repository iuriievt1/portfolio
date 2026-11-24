import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { HeroCarousel } from "@/features/hero-carousel/components/hero-carousel/hero-carousel";
import { HeroSlide } from "@/features/hero-carousel/components/hero-slide/hero-slide";
import { getSwipeStep } from "@/features/hero-carousel/hooks/use-hero-swipe";
import {
  getEventState,
  getHeroCardWidth,
  getHeroItems,
  getItemIndex,
  type HeroItem,
  toLiveHeroItem,
} from "@/features/hero-carousel/utils/hero-carousel";
import type { LiveChannel } from "@/features/live-channels/types";
import { createItem } from "../../__fixtures__/content";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

const PHONE = { fontScale: 1, height: 844, scale: 3, width: 390 };
const TABLET_PORTRAIT = { fontScale: 1, height: 1180, scale: 2, width: 820 };
const TABLET_LANDSCAPE = { fontScale: 1, height: 1024, scale: 2, width: 1366 };
const SHORT_TABLET_LANDSCAPE = {
  fontScale: 1,
  height: 768,
  scale: 2,
  width: 1024,
};

const windowSize = jest.spyOn(require("react-native"), "useWindowDimensions");

function getCardMaxWidth() {
  return screen.UNSAFE_getAllByType(HeroSlide)[0]?.props.sizeStyle.maxWidth;
}

function buildHeroItems(titles: string[]): HeroItem[] {
  return titles.map((title, index) => ({
    id: `hero-${index + 1}`,
    isLive: false,
    item: createItem({ contentType: "vod", id: `hero-${index + 1}`, title }),
    onPress: jest.fn(),
  }));
}

// A GO channel pick: only the channel, no programme.
const channelPick = createItem({
  contentType: "channel",
  id: "BFBSTV_EX",
  title: "BFBS Extra",
});

// BFBS Extra with the programme the guide says is on now.
function withProgramme(title: string): LiveChannel {
  return {
    currentProgramme: createItem({ id: `programme-${title}`, title }),
    id: "BFBSTV_EX",
    media: [
      {
        mimeType: "image/png",
        type: "regular",
        url: "https://example.com/bfbs-extra.png",
      },
    ],
    name: "BFBS Extra",
  };
}

function buildLiveItems(channel: LiveChannel): HeroItem[] {
  return getHeroItems({
    items: [channelPick],
    liveChannels: { BFBSTV_EX: channel },
    nowMs: BEFORE_START_MS,
  });
}

// A GO Live Event: Young Sheldon on BFBS Extra, 16:40 to 17:05.
const BEFORE_START_MS = Date.parse("2026-11-03T16:00:00.000Z");
const ON_AIR_MS = Date.parse("2026-11-03T16:50:00.000Z");
const AFTER_END_MS = Date.parse("2026-11-03T17:10:00.000Z");
const UPCOMING_LABEL = "Watch on 3 November at 16:40";

const liveEvent = createItem({
  channel: { id: "BFBSTV_EX", name: "BFBS Extra" },
  contentType: "episode",
  durationSeconds: 1500,
  id: "young-sheldon~BFBSTV_EX~ltv",
  parentalRating: { label: "12" },
  startDateTime: "2026-11-03T16:40:00.000Z",
  title: "Young Sheldon",
});

// BFBS Extra while the guide has the event on now.
const extraWithEvent: LiveChannel = {
  currentProgramme: liveEvent,
  id: "BFBSTV_EX",
  name: "BFBS Extra",
};

function buildEventItems(
  nowMs: number,
  liveChannels: Record<string, LiveChannel> = {},
  onLivePress?: (channel: LiveChannel) => void,
): HeroItem[] {
  return getHeroItems({
    items: [liveEvent],
    liveChannels,
    nowMs,
    onLivePress,
    timeZone: "Europe/London",
  });
}

const getCarousel = () => screen.getByRole("adjustable", { name: "Featured" });

// Simulates a screen reader user swiping left or right on the carousel.
function runScreenReaderAction(actionName: string) {
  act(() => {
    getCarousel().props.onAccessibilityAction({ nativeEvent: { actionName } });
  });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  windowSize.mockReturnValue(PHONE);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("HeroCarousel", () => {
  test("opens the current item when its card is pressed", () => {
    const items = buildHeroItems(["Carrie", "Traitors", "Garfield"]);

    render(<HeroCarousel items={items} />);
    fireEvent.press(screen.getByText("Carrie"));

    expect(items[0]?.onPress).toHaveBeenCalledTimes(1);
  });

  test("gives screen readers one adjustable carousel with the current item", () => {
    render(
      <HeroCarousel
        items={buildHeroItems(["Carrie", "Traitors", "Garfield"])}
      />,
    );

    expect(
      screen.getByRole("adjustable", { name: "Featured" }).props
        .accessibilityValue,
    ).toEqual({ text: "Carrie, 1 of 3" });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("lets screen readers move to the next and previous item, looping", () => {
    render(
      <HeroCarousel
        items={buildHeroItems(["Carrie", "Traitors", "Garfield"])}
      />,
    );

    runScreenReaderAction("increment");
    expect(getCarousel().props.accessibilityValue).toEqual({
      text: "Traitors, 2 of 3",
    });

    runScreenReaderAction("decrement");
    runScreenReaderAction("decrement");
    expect(getCarousel().props.accessibilityValue).toEqual({
      text: "Garfield, 3 of 3",
    });
  });

  test("lets screen readers open the current item", () => {
    const items = buildHeroItems(["Carrie", "Traitors"]);

    render(<HeroCarousel items={items} />);
    runScreenReaderAction("activate");

    expect(items[0]?.onPress).toHaveBeenCalledTimes(1);
  });

  test("keeps a single item as a plain button", () => {
    render(<HeroCarousel items={buildHeroItems(["Carrie"])} />);

    expect(screen.getByRole("button", { name: "Carrie" })).toBeTruthy();
    expect(screen.queryByRole("adjustable")).toBeNull();
  });

  test("shows the dots on phone when there are several items", () => {
    render(<HeroCarousel items={buildHeroItems(["Carrie", "Traitors"])} />);

    expect(
      screen.getByTestId("hero-dots", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  test("keeps the dots away from screen readers", () => {
    render(<HeroCarousel items={buildHeroItems(["Carrie", "Traitors"])} />);

    expect(screen.queryByTestId("hero-dots")).toBeNull();
  });

  test("hides the dots when there is one item", () => {
    render(<HeroCarousel items={buildHeroItems(["Carrie"])} />);

    expect(
      screen.queryByTestId("hero-dots", { includeHiddenElements: true }),
    ).toBeNull();
  });

  test("hides the dots on tablet", () => {
    windowSize.mockReturnValue(TABLET_PORTRAIT);

    render(<HeroCarousel items={buildHeroItems(["Carrie", "Traitors"])} />);

    expect(
      screen.queryByTestId("hero-dots", { includeHiddenElements: true }),
    ).toBeNull();
  });

  test("caps the tablet card at its Figma size", () => {
    windowSize.mockReturnValue(TABLET_LANDSCAPE);

    render(<HeroCarousel items={buildHeroItems(["Carrie", "Traitors"])} />);

    expect(getCardMaxWidth()).toBe(960);
  });

  test("shrinks the tablet card to fit a short landscape window", () => {
    windowSize.mockReturnValue(SHORT_TABLET_LANDSCAPE);

    render(<HeroCarousel items={buildHeroItems(["Carrie", "Traitors"])} />);

    // 768 - 167 header - 32 gaps - 62 tab bar = 507 high, at 16:9.
    expect(getCardMaxWidth()).toBeCloseTo((507 * 16) / 9);
  });

  test("draws nothing when there are no items", () => {
    render(<HeroCarousel items={[]} />);

    expect(
      screen.queryByTestId("hero-card", { includeHiddenElements: true }),
    ).toBeNull();
  });

  test("shows what's on now for a channel pick", () => {
    render(
      <HeroCarousel items={buildLiveItems(withProgramme("The Office"))} />,
    );

    expect(screen.getByText("The Office")).toBeTruthy();
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.queryByText("BFBS Extra")).toBeNull();
  });

  test("switches to the next programme when the guide moves on", () => {
    const { rerender } = render(
      <HeroCarousel items={buildLiveItems(withProgramme("The Office"))} />,
    );
    expect(screen.getByText("The Office")).toBeTruthy();

    rerender(<HeroCarousel items={buildLiveItems(withProgramme("Scrubs"))} />);
    expect(screen.getByText("Scrubs")).toBeTruthy();
    expect(screen.queryByText("The Office")).toBeNull();
  });

  test("shows the channel name and LIVE when the guide has no programme", () => {
    render(
      <HeroCarousel
        items={buildLiveItems({ id: "BFBSTV_EX", name: "BFBS Extra" })}
      />,
    );

    expect(screen.getAllByText("BFBS Extra")).toHaveLength(2);
    expect(screen.getByText("LIVE")).toBeTruthy();
  });

  test("moves a Live Event from upcoming to live to gone as the guide moves on", () => {
    const onLivePress = jest.fn();
    const { rerender } = render(
      <HeroCarousel items={buildEventItems(BEFORE_START_MS)} />,
    );

    expect(screen.getByText(UPCOMING_LABEL)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <HeroCarousel
        items={buildEventItems(
          ON_AIR_MS,
          { [liveEvent.id]: extraWithEvent },
          onLivePress,
        )}
      />,
    );
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.queryByText(UPCOMING_LABEL)).toBeNull();

    fireEvent.press(
      screen.getByRole("button", { name: "Young Sheldon, Live" }),
    );
    expect(onLivePress).toHaveBeenCalledWith(extraWithEvent);

    rerender(<HeroCarousel items={buildEventItems(AFTER_END_MS)} />);
    expect(
      screen.queryByTestId("hero-card", { includeHiddenElements: true }),
    ).toBeNull();
  });

  test("tells screen readers when an upcoming event starts", () => {
    render(<HeroCarousel items={buildEventItems(BEFORE_START_MS)} />);

    expect(
      screen.getByLabelText(`Young Sheldon, ${UPCOMING_LABEL}`),
    ).toBeTruthy();
  });

  test("tells screen readers the current card is live or when it starts", () => {
    const { rerender } = render(
      <HeroCarousel
        items={[
          ...buildEventItems(BEFORE_START_MS),
          ...buildHeroItems(["Carrie"]),
        ]}
      />,
    );

    expect(getCarousel().props.accessibilityValue).toEqual({
      text: `Young Sheldon, ${UPCOMING_LABEL}, 1 of 2`,
    });

    rerender(
      <HeroCarousel
        items={[
          ...buildEventItems(ON_AIR_MS, { [liveEvent.id]: extraWithEvent }),
          ...buildHeroItems(["Carrie"]),
        ]}
      />,
    );
    expect(getCarousel().props.accessibilityValue).toEqual({
      text: "Young Sheldon, Live, 1 of 2",
    });
  });
});

describe("getEventState", () => {
  test("is upcoming before the start, live until the end, then ended", () => {
    expect(getEventState(liveEvent, BEFORE_START_MS)).toBe("upcoming");
    expect(getEventState(liveEvent, ON_AIR_MS)).toBe("live");
    expect(getEventState(liveEvent, AFTER_END_MS)).toBe("ended");
  });

  test("leaves out VOD and channel picks", () => {
    const vodItem = createItem({ contentType: "vod" });

    expect(getEventState(vodItem, ON_AIR_MS)).toBeUndefined();
    expect(getEventState(channelPick, ON_AIR_MS)).toBeUndefined();
  });
});

describe("getHeroItems", () => {
  const vodItem = createItem({
    contentType: "vod",
    id: "hero-1",
    title: "Carrie",
  });
  const channel = withProgramme("The Office");

  test("keeps GO's order and opens a VOD item like a tile", () => {
    const onContentPress = jest.fn();
    const items = getHeroItems({
      items: [vodItem, channelPick],
      liveChannels: { BFBSTV_EX: channel },
      nowMs: BEFORE_START_MS,
      onContentPress,
    });

    expect(items.map(({ id }) => id)).toEqual(["hero-1", "BFBSTV_EX"]);
    expect(items[0]).toMatchObject({ isLive: false, item: vodItem });

    items[0]?.onPress?.();
    expect(onContentPress).toHaveBeenCalledWith(vodItem);
  });

  test("turns a channel pick on the line-up into a live card that plays it", () => {
    const onContentPress = jest.fn();
    const onLivePress = jest.fn();
    const [liveCard] = getHeroItems({
      items: [channelPick],
      liveChannels: { BFBSTV_EX: channel },
      nowMs: BEFORE_START_MS,
      onContentPress,
      onLivePress,
    });

    expect(liveCard).toMatchObject({
      isLive: true,
      item: { title: "The Office" },
    });

    liveCard?.onPress?.();
    expect(onLivePress).toHaveBeenCalledWith(channel);
    expect(onContentPress).not.toHaveBeenCalled();
  });

  test("keeps a channel pick off the line-up as a normal card", () => {
    const onContentPress = jest.fn();
    const [card] = getHeroItems({
      items: [channelPick],
      liveChannels: {},
      nowMs: BEFORE_START_MS,
      onContentPress,
    });

    expect(card).toMatchObject({ isLive: false, item: channelPick });

    card?.onPress?.();
    expect(onContentPress).toHaveBeenCalledWith(channelPick);
  });

  test("shows an upcoming event with its start time and nothing to open", () => {
    const [card] = buildEventItems(BEFORE_START_MS);

    expect(card).toMatchObject({
      isLive: false,
      upcomingLabel: UPCOMING_LABEL,
    });
    expect(card?.onPress).toBeUndefined();
  });

  test("plays an event live while the guide has it on now, keeping its own details", () => {
    const onLivePress = jest.fn();
    const [card] = buildEventItems(
      ON_AIR_MS,
      { [liveEvent.id]: extraWithEvent },
      onLivePress,
    );

    expect(card).toMatchObject({ isLive: true, item: liveEvent });

    card?.onPress?.();
    expect(onLivePress).toHaveBeenCalledWith(extraWithEvent);
  });

  test("keeps an event waiting with no tap until the guide has it on now", () => {
    const [card] = buildEventItems(ON_AIR_MS);

    expect(card).toMatchObject({
      isLive: false,
      upcomingLabel: UPCOMING_LABEL,
    });
    expect(card?.onPress).toBeUndefined();
  });

  test("hides an event once it has ended, unless the guide still has it on now", () => {
    expect(buildEventItems(AFTER_END_MS)).toEqual([]);
    expect(
      buildEventItems(AFTER_END_MS, { [liveEvent.id]: extraWithEvent }),
    ).toMatchObject([{ isLive: true }]);
  });
});

describe("toLiveHeroItem", () => {
  test("shows the current programme with the channel attached", () => {
    const channel = withProgramme("The Office");

    expect(toLiveHeroItem(channelPick, channel)).toEqual({
      ...channel.currentProgramme,
      channel,
    });
  });

  test("keeps the GO item with the channel's name when there is no programme", () => {
    const channel: LiveChannel = { id: "BFBSTV_EX", name: "BFBS Extra HD" };

    expect(toLiveHeroItem(channelPick, channel)).toEqual({
      ...channelPick,
      channel,
      title: "BFBS Extra HD",
    });
  });
});

describe("getHeroCardWidth", () => {
  test("keeps the phone card inside the 16px side gaps", () => {
    expect(getHeroCardWidth("phone", 390)).toBe(358);
  });

  test("gives the tablet card the portrait card's share of the width", () => {
    expect(getHeroCardWidth("tabletPortrait", 820)).toBeCloseTo(741);
    expect(getHeroCardWidth("tabletLandscape", 1024)).toBeCloseTo(925.35, 1);
  });

  test("caps the tablet card at 960", () => {
    expect(getHeroCardWidth("tabletLandscape", 1180)).toBe(960);
  });
});

describe("getItemIndex", () => {
  test("loops past both ends", () => {
    expect(getItemIndex(-1, 3)).toBe(2);
    expect(getItemIndex(3, 3)).toBe(0);
    expect(getItemIndex(-4, 3)).toBe(2);
    expect(getItemIndex(7, 3)).toBe(1);
  });
});

describe("getSwipeStep", () => {
  const ITEM_SIZE = 300;

  test("moves to the next card on a left drag or flick", () => {
    expect(getSwipeStep(-100, 0, ITEM_SIZE)).toBe(1);
    expect(getSwipeStep(-5, -0.5, ITEM_SIZE)).toBe(1);
  });

  test("moves to the previous card on a right drag or flick", () => {
    expect(getSwipeStep(100, 0, ITEM_SIZE)).toBe(-1);
    expect(getSwipeStep(5, 0.5, ITEM_SIZE)).toBe(-1);
  });

  test("stays on a short, slow drag", () => {
    expect(getSwipeStep(-20, 0, ITEM_SIZE)).toBe(0);
  });
});
