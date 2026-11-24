import type { ContentItem, ContentList } from "@bfbs/common-sdk";
import { fireEvent, render } from "@testing-library/react-native";
import { View } from "react-native";
import { EpisodeCard } from "@/features/watch-details/components/episode-card/episode-card";
import { EpisodesFooter } from "@/features/watch-details/components/episodes-footer/episodes-footer";
import { SeasonSelector } from "@/features/watch-details/components/season-selector/season-selector";
import { getNextPageParam } from "@/features/watch-details/utils/next-page-param";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

const SEASON_ONE: ContentItem = {
  id: "season-1",
  seasonNumber: "1",
  title: "Season one",
};
const SEASON_TWO: ContentItem = {
  id: "season-2",
  seasonNumber: "2",
  title: "Season two",
};

function episodePage(ids: string[], endLocator: string): ContentList {
  return {
    items: ids.map((id) => ({ id, title: id })),
    metadata: {
      count: ids.length,
      locators: { end: endLocator, start: "" },
      total: ids.length,
    },
  };
}

describe("series episodes tab", () => {
  test("the picker opens the list and picks another series", () => {
    // Jest's View never measures, so give the pill a position.
    jest
      .spyOn(View.prototype, "measureInWindow")
      .mockImplementation((callback) => callback(0, 0, 114, 34));
    const onSelect = jest.fn();
    const { getByTestId, getByText } = render(
      <SeasonSelector
        onSelect={onSelect}
        seasons={[SEASON_ONE, SEASON_TWO]}
        selectedSeason={SEASON_ONE}
      />,
    );

    fireEvent.press(getByTestId("season-selector"));
    fireEvent.press(getByText("Series 2"));

    expect(onSelect).toHaveBeenCalledWith(SEASON_TWO);
  });

  test("an episode card shows its label, length and progress, and plays on press", () => {
    const onPress = jest.fn();
    const episode: ContentItem = {
      contentType: "episode",
      durationSeconds: 1800,
      episodeNumber: "1",
      episodeTitle: "Pilot",
      id: "episode-1",
      lastPlayPositionSeconds: 900,
      title: "The Office",
    };
    const { getByLabelText, getByTestId, getByText } = render(
      <EpisodeCard episode={episode} onPress={onPress} />,
    );

    getByText("30 min");
    getByTestId("content-tile-progress");
    fireEvent.press(getByLabelText("E1 - Pilot"));

    expect(onPress).toHaveBeenCalledWith(episode);
  });

  test("pages follow the end locator and stop on a repeated locator or nothing new", () => {
    const first = episodePage(["e1", "e2"], "a");
    const repeatedLocator = episodePage(["e3"], "a");
    const nothingNew = episodePage(["e2"], "b");

    expect(getNextPageParam(first, [first])).toEqual({
      locator: "a",
      offset: 1,
    });
    expect(
      getNextPageParam(repeatedLocator, [first, repeatedLocator]),
    ).toBeUndefined();
    expect(getNextPageParam(nothingNew, [first, nothingNew])).toBeUndefined();
  });

  test("an empty season shows no loading rows and no error", () => {
    const { toJSON } = render(
      <EpisodesFooter
        hasError={false}
        isLoading={false}
        isTablet={false}
        onRetry={jest.fn()}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  test("a failed load shows Try again, which retries", () => {
    const retry = jest.fn();
    const { getByTestId } = render(
      <EpisodesFooter
        hasError
        isLoading={false}
        isTablet={false}
        onRetry={retry}
      />,
    );

    fireEvent.press(getByTestId("episodes-retry"));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
