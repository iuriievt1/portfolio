import { render } from "@testing-library/react-native";

type StackProps = { screenOptions?: Record<string, unknown> };

const mockStack = jest.fn<void, [StackProps]>();

jest.mock("expo-router", () => ({
  Stack: (props: StackProps) => {
    mockStack(props);

    return null;
  },
}));

const LAYOUTS = [
  ["home", "@/app/(tabs)/(home)/_layout"],
  ["on-now", "@/app/(tabs)/on-now/_layout"],
  ["search", "@/app/(tabs)/search/_layout"],
  ["section", "@/app/(tabs)/[sectionSlug]/_layout"],
] as const;

describe("tab stack layouts", () => {
  beforeEach(() => {
    mockStack.mockClear();
  });

  for (const [name, modulePath] of LAYOUTS) {
    test(`${name} freezes blurred screens so a deep stack stays cheap`, () => {
      const Layout = require(modulePath).default;

      render(<Layout />);

      expect(mockStack).toHaveBeenCalledWith({
        screenOptions: { freezeOnBlur: true, headerShown: false },
      });
    });
  }
});
