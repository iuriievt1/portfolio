import { fireEvent, render } from "@testing-library/react-native";
import { WatchDetailsScreen } from "@/features/watch-details/watch-details-screen";

const mockBack = jest.fn();
const mockUseAsset = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ assetId: "asset-1" }),
  useRouter: () => ({ back: mockBack }),
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
  useRelatedAssets: () => ({ isError: false, isLoading: false, items: [] }),
}));

jest.mock("@/features/favourites", () => ({
  useToggleFavourite: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock("@/utils/device-layout", () => ({
  ...jest.requireActual("@/utils/device-layout"),
  isTabletLayout: () => false,
}));

describe("<WatchDetailsScreen />", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockUseAsset.mockReset();
  });

  test("requests the asset id from the route params", () => {
    mockUseAsset.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: true,
    });

    render(<WatchDetailsScreen />);

    expect(mockUseAsset).toHaveBeenCalledWith("asset-1");
  });

  test("renders the loading state while the asset loads", () => {
    mockUseAsset.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: true,
    });

    const { getByTestId } = render(<WatchDetailsScreen />);

    getByTestId("watch-details-skeleton");
  });

  test("shows the error state and navigates back when the asset fails", () => {
    mockUseAsset.mockReturnValue({
      data: undefined,
      error: new Error("Request failed"),
      isError: true,
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByTestId, getByText } = render(<WatchDetailsScreen />);

    getByTestId("error-full-screen");
    getByText("Something went wrong");

    fireEvent.press(getByTestId("error-action-back"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test("renders the asset title when loaded", () => {
    mockUseAsset.mockReturnValue({
      data: { id: "asset-1", title: "Muriel's Wedding" },
      isError: false,
      isLoading: false,
    });

    const { getByText } = render(<WatchDetailsScreen />);

    getByText("Muriel's Wedding");
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

  test("renders the age rating icon when present", () => {
    mockUseAsset.mockReturnValue({
      data: {
        contentType: "standalone",
        id: "asset-1",
        parentalRating: { label: "12" },
        title: "Muriel's Wedding",
      },
      isError: false,
      isLoading: false,
    });

    const { getByTestId } = render(<WatchDetailsScreen />);

    getByTestId("age-rating-12");
  });

  test("shows the leaving date and time for a movie leaving within 30 days", () => {
    mockUseAsset.mockReturnValue({
      data: {
        expirationDateTime: new Date(
          Date.now() + 5 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        id: "asset-1",
        title: "Muriel's Wedding",
      },
      isError: false,
      isLoading: false,
    });

    const { getByText } = render(<WatchDetailsScreen />);

    getByText(/^Leaving on .+ at \d{2}:\d{2}$/);
  });

  test("shows the continue watching bar and Resume label when partially watched", () => {
    mockUseAsset.mockReturnValue({
      data: {
        durationSeconds: 120,
        id: "asset-1",
        lastPlayPositionSeconds: 60,
        title: "Muriel's Wedding",
      },
      isError: false,
      isLoading: false,
    });

    const { getByText } = render(<WatchDetailsScreen />);

    getByText("1m remaining");
    getByText("Resume");
  });
});
