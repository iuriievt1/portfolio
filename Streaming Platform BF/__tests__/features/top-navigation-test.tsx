import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  getTopNavigationHeaderHeight,
  TopNavigationHeader,
} from "@/features/top-navigation/components/top-navigation-header";

const mockPush = jest.fn();

function getTextContent(node: { children: unknown[] }): string {
  return node.children
    .map((child) =>
      typeof child === "string"
        ? child
        : getTextContent(child as { children: unknown[] }),
    )
    .join("");
}

jest.mock("expo-router", () => ({
  usePathname: () => "/sport",
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  queryOptions: jest.fn((options) => options),
  useQuery: jest.fn(),
}));

describe("top navigation", () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(useQuery).mockReturnValue({
      data: {
        navigation: { id: "root", name: "Root" },
        sections: [
          {
            navigationItem: { id: "sdk-home", name: "SDK Home" },
            pageCategory: { id: "sdk-home", name: "SDK Home" },
            rails: [],
            route: "/",
          },
          {
            navigationItem: { id: "sdk-live", name: "Live TV" },
            pageCategory: { id: "sdk-live", name: "Live TV" },
            rails: [],
            route: "/on-now",
          },
          {
            navigationItem: { id: "sdk-sport", name: "SDK Sport" },
            pageCategory: { id: "sdk-sport", name: "SDK Sport" },
            rails: [],
            route: "/sport",
          },
          {
            navigationItem: { id: "sdk-more", name: "SDK More" },
            pageCategory: { id: "sdk-more", name: "SDK More" },
            rails: [],
            route: "/more",
          },
          {
            navigationItem: { id: "sdk-tv-guide", name: "SDK TV Guide" },
            pageCategory: { id: "sdk-tv-guide", name: "SDK TV Guide" },
            rails: [],
            route: "/tv-guide",
          },
          {
            navigationItem: { id: "sdk-films", name: "SDK Films" },
            pageCategory: { id: "sdk-films", name: "SDK Films" },
            rails: [],
            route: "/tv-film",
          },
        ],
      },
      isLoading: false,
    } as ReturnType<typeof useQuery>);
  });

  test("renders active top nav state and navigates to supported routes", async () => {
    const { getAllByRole, getByTestId, getByText, toJSON } = render(
      <TopNavigationHeader />,
    );

    await waitFor(() => {
      getByText("SDK Sport");
      getByText("SDK TV Guide");
      getByText("SDK Films");
      getByText("SDK More");
    });

    expect(toJSON()).toMatchObject({
      props: { className: "items-center bg-dark-slate-blue px-4" },
    });
    expect(getByTestId("top-nav-sport").props.accessibilityState).toEqual({
      selected: true,
    });
    expect(getAllByRole("link").map(getTextContent)).toEqual([
      "SDK Sport",
      "SDK More",
      "SDK TV Guide",
      "SDK Films",
    ]);

    fireEvent.press(getByTestId("top-nav-tv-guide"));
    fireEvent.press(getByTestId("top-nav-tv-film"));

    expect(mockPush).toHaveBeenCalledWith("/tv-guide");
    expect(mockPush).toHaveBeenCalledWith("/tv-film");
  });

  test("does not push the active route again", async () => {
    const { getByTestId } = render(<TopNavigationHeader />);

    await waitFor(() => {
      getByTestId("top-nav-sport");
    });

    fireEvent.press(getByTestId("top-nav-sport"));

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("does not invent top navigation labels while SDK navigation is unavailable", () => {
    jest.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useQuery>);

    const { queryByText } = render(<TopNavigationHeader />);

    expect(queryByText("Sport")).toBeNull();
    expect(queryByText("TV Guide")).toBeNull();
    expect(queryByText("TV & Film")).toBeNull();
    expect(queryByText("More")).toBeNull();
  });
});

describe("getTopNavigationHeaderHeight", () => {
  test("adds the top inset to each layout's header height", () => {
    expect(
      getTopNavigationHeaderHeight({
        isLandscape: false,
        isTablet: false,
        topInset: 47,
      }),
    ).toBe(173);
    expect(
      getTopNavigationHeaderHeight({
        isLandscape: false,
        isTablet: true,
        topInset: 24,
      }),
    ).toBe(190);
    expect(
      getTopNavigationHeaderHeight({
        isLandscape: true,
        isTablet: true,
        topInset: 24,
      }),
    ).toBe(191);
  });
});
