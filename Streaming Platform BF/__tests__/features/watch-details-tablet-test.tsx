import { render } from "@testing-library/react-native";
import { WatchDetailsScreen } from "@/features/watch-details/watch-details-screen";

const mockUseAsset = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ assetId: "asset-1" }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock("@/features/watch-details/hooks/use-asset", () => ({
  useAsset: (assetId: string | undefined) => mockUseAsset(assetId),
}));

jest.mock("@/features/watch-details/hooks/use-show", () => ({
  useShow: () => ({ data: undefined, isError: false, isLoading: false }),
}));

jest.mock("@/features/watch-details/hooks/use-show-episode", () => ({
  useShowEpisode: () => ({ data: undefined }),
}));

jest.mock("@/features/watch-details/hooks/use-show-seasons", () => ({
  useShowSeasons: () => ({ data: undefined }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("@/features/watch-details/hooks/use-related-assets", () => ({
  useRelatedAssets: () => ({ data: [] }),
}));

jest.mock("@/features/favourites", () => ({
  useToggleFavourite: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock("@/utils/device-layout", () => ({
  ...jest.requireActual("@/utils/device-layout"),
  isTabletLayout: () => true,
}));

describe("<WatchDetailsScreen /> on tablet", () => {
  beforeEach(() => {
    mockUseAsset.mockReset();
  });

  test("shows the branded placeholder when the asset has no artwork", () => {
    mockUseAsset.mockReturnValue({
      data: { id: "asset-1", title: "Muriel's Wedding" },
      isError: false,
      isLoading: false,
    });

    const { getByTestId } = render(<WatchDetailsScreen />);

    getByTestId("programme-artwork-fallback-image");
  });

  test("renders the artwork instead of the placeholder when present", () => {
    mockUseAsset.mockReturnValue({
      data: {
        id: "asset-1",
        media: [{ type: "image", url: "https://example.test/art.jpg" }],
        title: "Muriel's Wedding",
      },
      isError: false,
      isLoading: false,
    });

    const { queryByTestId } = render(<WatchDetailsScreen />);

    expect(queryByTestId("programme-artwork-fallback")).toBeNull();
  });
});
