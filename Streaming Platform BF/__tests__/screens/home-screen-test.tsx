import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockUseLiveChannels = jest.fn();

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
}));

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}));

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  ContentCatalogue: {
    getNavigation: jest.fn(),
  },
  ContentCategoryTemplate: {
    HERO: "HERO",
    SIXTEEN_BY_NINE_DESIGNED_LARGE: "SIXTEEN_BY_NINE_DESIGNED_LARGE",
    SIXTEEN_BY_NINE_DESIGNED_SMALL: "SIXTEEN_BY_NINE_DESIGNED_SMALL",
    SIXTEEN_BY_NINE_LARGE: "SIXTEEN_BY_NINE_LARGE",
    SIXTEEN_BY_NINE_STANDARD: "SIXTEEN_BY_NINE_STANDARD",
    SQUARE_LARGE: "SQUARE_LARGE",
    SQUARE_SMALL: "SQUARE_SMALL",
  },
}));

jest.mock("@/features/live-channels/hooks/use-live-channels", () => ({
  useLiveChannels: () => mockUseLiveChannels(),
}));

jest.mock("@/features/top-navigation/components/top-navigation-header", () => ({
  TopNavigationHeader: () => null,
}));

const HomeScreen = require("@/app/(tabs)/(home)/index").default;

import {
  createCategory,
  createItem,
  createRail,
} from "../../__fixtures__/content";

const {
  appContentQueryOptions,
} = require("@/features/content-rails/app-content");

const newsRail = createRail({
  category: createCategory({ id: "news-rail", name: "BFBS News" }),
  items: Array.from({ length: 16 }, (_, index) =>
    createItem({
      contentType: "standalone",
      id: `news-${index + 1}`,
      title: `News ${index + 1}`,
    }),
  ),
});

const homeContent = {
  navigation: {
    category: createCategory({ id: "root", name: "Root" }),
    children: [{ category: createCategory({ id: "Home", name: "Home" }) }],
  },
  sections: [
    {
      navigationItem: createCategory({ id: "Home", name: "Home" }),
      pageCategory: createCategory({ id: "home-page", name: "Home" }),
      rails: [newsRail],
      route: "/",
    },
  ],
};

function renderHomeScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  queryClient.setQueryData(appContentQueryOptions.queryKey, homeContent);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<HomeScreen />, { wrapper });
}

describe("<HomeScreen />", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockNavigate.mockClear();
    mockUseLiveChannels.mockReturnValue({ channels: [] });
  });

  test("renders the SDK content rails without the hardcoded hero", () => {
    const { getByText, queryByLabelText } = renderHomeScreen();

    expect(queryByLabelText("The Darjeeling Limited")).toBeNull();
    getByText("BFBS News");
    getByText("News 1");
  });

  test("navigates to the watch details page from a content tile", () => {
    const { getByText } = renderHomeScreen();

    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.press(getByText("News 1"));

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { assetId: "news-1" },
      pathname: "/watch/[assetId]",
    });
  });

  test("navigates to the view-all page when a View All tile is pressed", () => {
    const { getAllByLabelText } = renderHomeScreen();

    fireEvent.press(getAllByLabelText("View All")[0]);

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { railId: "news-rail", sectionRoute: "/" },
      pathname: "/view-all/[railId]",
    });
  });
});
