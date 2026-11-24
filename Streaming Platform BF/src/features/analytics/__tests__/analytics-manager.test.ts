import { EventBus, EventType } from "@bfbs/common-sdk";
import { analyticsManager } from "../analytics-manager";

jest.mock("@bfbs/common-sdk", () => ({
  EventBus: {
    produce: jest.fn(),
    getAll$: jest.fn(() => "sdk-events"),
  },
  EventType: { APP_START: "APP_START" },
  GoAnalytics: { requestFlush: jest.fn() },
}));

describe("GO Analytics helpers", () => {
  it("publishes app events through the Common SDK event bus", () => {
    analyticsManager.track({ type: EventType.APP_START, data: {} });

    expect(EventBus.produce).toHaveBeenCalledWith({
      type: EventType.APP_START,
      data: {},
    });
  });
});
