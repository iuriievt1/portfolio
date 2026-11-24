import type { ContentItem } from "@bfbs/common-sdk";
import { fireEvent, render } from "@testing-library/react-native";
import { WatchDetailsTabs } from "@/features/watch-details/components/watch-details-tabs/watch-details-tabs";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/features/watch-details/hooks/use-related-assets", () => ({
  useRelatedAssets: () => ({ isError: false, isLoading: false, items: [] }),
}));

const asset: ContentItem = {
  contentAdvisories: [{ label: "Violence" }],
  contentType: "standalone",
  credits: { actors: ["Actor One"], directors: ["Director One"] },
  id: "asset-1",
  parentalRating: { value: 15 },
  productionYear: 1994,
  synopsis: "A short synopsis.",
  title: "Muriel's Wedding",
};

describe("<WatchDetailsTabs />", () => {
  test("hides Related and opens on More Details for a non-VOD asset", () => {
    const { getByText, queryByTestId, queryByText } = render(
      <WatchDetailsTabs asset={{ ...asset, contentType: "channel" }} />,
    );

    expect(queryByText("Related")).toBeNull();
    expect(queryByTestId("related-grid-message")).toBeNull();
    getByText("Description");
  });

  test("shows the Related pane by default", () => {
    const { getByTestId } = render(<WatchDetailsTabs asset={asset} />);

    getByTestId("related-grid-message");
  });

  test("hides More Details when the film has no details", () => {
    const { getByText, queryByText } = render(
      <WatchDetailsTabs
        asset={{ contentType: "standalone", id: "asset-2", title: "Bare" }}
      />,
    );

    getByText("Related");
    expect(queryByText("More Details")).toBeNull();
  });

  test("switches to More Details and renders sections from the asset", () => {
    const { getByText, queryByTestId } = render(
      <WatchDetailsTabs asset={asset} />,
    );

    fireEvent.press(getByText("More Details"));

    getByText("Description");
    getByText("A short synopsis.");
    getByText("Cast");
    getByText("Actor One");
    getByText("Crew");
    getByText("Director One");
    expect(queryByTestId("related-grid-message")).toBeNull();
  });
});
