import { fireEvent, render, screen } from "@testing-library/react-native";
import { HeroCard } from "@/features/hero-carousel/components/hero-card/hero-card";
import { createItem } from "../../__fixtures__/content";

const SYNOPSIS = "Two friends open a café.";
const TITLE = "Strictly Come Dancing";

const withTitleArt = createItem({
  contentType: "episode",
  media: [
    {
      height: 1000,
      mimeType: "image/png",
      type: "titleTreatmentNeutral",
      url: "https://example.com/title-art.png",
      width: 1800,
    },
  ],
  title: TITLE,
});

describe("HeroCard", () => {
  test("shows two genres, the type and the year", () => {
    render(
      <HeroCard
        formFactor="phone"
        item={createItem({
          contentType: "vod",
          genres: ["Comedy", "Drama", "Romance"],
          productionYear: 1994,
        })}
        width={343}
      />,
    );

    expect(screen.getByText("Comedy Drama")).toBeTruthy();
    expect(screen.getByText("Film")).toBeTruthy();
    expect(screen.getByText("1994")).toBeTruthy();
    expect(screen.queryByText("Romance")).toBeNull();
  });

  test("labels shows as a series", () => {
    render(
      <HeroCard
        formFactor="phone"
        item={createItem({ contentType: "show", genres: ["Horror Drama"] })}
        width={343}
      />,
    );

    expect(screen.getByText("Series")).toBeTruthy();
  });

  test("gives the description 3 lines on phone and 2 on tablet", () => {
    const item = createItem({ contentType: "vod", description: SYNOPSIS });

    const { rerender } = render(
      <HeroCard formFactor="phone" item={item} width={343} />,
    );
    expect(screen.getByText(SYNOPSIS).props.numberOfLines).toBe(3);

    rerender(<HeroCard formFactor="tabletPortrait" item={item} width={741} />);
    expect(screen.getByText(SYNOPSIS).props.numberOfLines).toBe(2);
  });

  test("shows the LIVE row with the on-air time and rating for a live pick", () => {
    render(
      <HeroCard
        formFactor="phone"
        isLive
        item={createItem({
          contentType: "episode",
          durationSeconds: 3600,
          genres: ["Comedy"],
          parentalRating: { label: "12" },
          startDateTime: "2026-11-02T14:00:00.000Z",
        })}
        width={343}
      />,
    );

    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.getByText(/\d{1,2}:\d{2} - \d{1,2}:\d{2}/)).toBeTruthy();
    expect(screen.getByTestId("age-rating-12")).toBeTruthy();
    expect(screen.queryByText("Comedy")).toBeNull();
  });

  test("closes the LIVE row up when the time and rating are missing", () => {
    render(
      <HeroCard
        formFactor="phone"
        isLive
        item={createItem({ contentType: "channel", title: "BFBS Extra" })}
        width={343}
      />,
    );

    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).toBeNull();
    expect(screen.queryByTestId(/^age-rating-/)).toBeNull();
  });

  test("shows when an upcoming event starts, then its rating", () => {
    render(
      <HeroCard
        formFactor="phone"
        item={createItem({
          contentType: "episode",
          genres: ["Comedy"],
          parentalRating: { label: "12" },
        })}
        upcomingLabel="Watch on 3 November at 16:40"
        width={343}
      />,
    );

    expect(screen.getByText("Watch on 3 November at 16:40")).toBeTruthy();
    expect(screen.getByTestId("age-rating-12")).toBeTruthy();
    expect(screen.queryByText("LIVE")).toBeNull();
    expect(screen.queryByText("Comedy")).toBeNull();
  });

  test("closes the upcoming row up and shows the placeholder when details are missing", () => {
    render(
      <HeroCard
        formFactor="phone"
        item={createItem({ contentType: "episode" })}
        upcomingLabel="Watch on 3 November at 16:40"
        width={343}
      />,
    );

    expect(screen.getByText("Watch on 3 November at 16:40")).toBeTruthy();
    expect(screen.queryByTestId(/^age-rating-/)).toBeNull();
    expect(screen.getByTestId("programme-artwork-fallback-image")).toBeTruthy();
  });

  test("shows the programme placeholder when the image is missing", () => {
    render(
      <HeroCard
        formFactor="phone"
        item={createItem({ contentType: "vod" })}
        width={343}
      />,
    );

    expect(screen.getByTestId("programme-artwork-fallback-image")).toBeTruthy();
  });

  test("shows the channel name when the logo is missing", () => {
    render(
      <HeroCard
        formFactor="phone"
        item={createItem({
          channel: { id: "bbc-four", name: "BBC Four" },
          contentType: "vod",
        })}
        width={343}
      />,
    );

    expect(screen.getByTestId("hero-card-channel-fallback")).toHaveTextContent(
      "BBC Four",
    );
  });

  test("shows the title art in place of the title text", () => {
    render(<HeroCard formFactor="phone" item={withTitleArt} width={343} />);

    expect(screen.getByTestId("hero-card-title-art")).toBeTruthy();
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  test("shows the title text when there's no title art", () => {
    render(
      <HeroCard
        formFactor="phone"
        item={createItem({ contentType: "vod", title: TITLE })}
        width={343}
      />,
    );

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.queryByTestId("hero-card-title-art")).toBeNull();
  });

  test("shows the title text when the title art fails to load", () => {
    render(<HeroCard formFactor="phone" item={withTitleArt} width={343} />);

    fireEvent(screen.getByTestId("hero-card-title-art"), "error", {
      nativeEvent: { error: "not found" },
    });

    expect(screen.queryByTestId("hero-card-title-art")).toBeNull();
    expect(screen.getByText(TITLE)).toBeTruthy();
  });
});
