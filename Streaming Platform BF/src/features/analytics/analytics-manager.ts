import {
  type Event,
  EventBus,
  type EventType,
  GoAnalytics,
} from "@bfbs/common-sdk";

/** Provides the app's single entry point to the Common SDK analytics bus. */
export class AnalyticsManager {
  /** Publishes an app analytics event to the SDK's buffered event bus. */
  track<T extends EventType>(
    event: Event<T> extends infer TEvent
      ? TEvent extends { eventClass: unknown }
        ? Omit<TEvent, "eventClass">
        : never
      : never,
  ) {
    EventBus.produce(event);
  }

  /** Requests an early flush of analytics events held by Clarissa. */
  flush() {
    GoAnalytics.requestFlush();
  }
}

/** Shared manager instance used by app features. */
export const analyticsManager = new AnalyticsManager();
