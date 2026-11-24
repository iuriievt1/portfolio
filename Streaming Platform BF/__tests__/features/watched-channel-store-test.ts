import { act, renderHook } from "@testing-library/react-native";
import {
  setWatchedChannelId,
  useWatchedChannelId,
} from "@/features/live-channels";

describe("watched channel store", () => {
  test("starts with no channel", () => {
    const { result } = renderHook(useWatchedChannelId);

    expect(result.current).toBeNull();
  });

  test("shares the channel the user is now watching", () => {
    const { result } = renderHook(useWatchedChannelId);

    act(() => {
      setWatchedChannelId("two");
    });

    expect(result.current).toBe("two");
  });
});
