import { renderHook } from "@testing-library/react-native";

import useRenderDebugger, {
  type RenderDebugEvent,
  type UseRenderDebuggerResult,
} from "../useRenderDebugger";

type ValueProps<T = number> = {
  value: T;
};

type PlayerProps = {
  channelId: string;
  contentType: "live" | "vod";
};

type WatchedProps = {
  watched: {
    item: {
      id: string;
    };
  };
};

describe("useRenderDebugger", () => {
  it("reports the initial committed render", () => {
    const onRender = jest.fn();
    const { result } = renderHook(() =>
      useRenderDebugger(
        "DebugComponent",
        { value: 1 },
        { log: false, onRender },
      ),
    );

    expect(onRender).toHaveBeenCalledTimes(1);
    expect(onRender).toHaveBeenLastCalledWith(
      expect.objectContaining({
        componentName: "DebugComponent",
        renderCount: 1,
        rerenderCount: 0,
        reason: "initial-render",
        changes: [],
      }),
    );
    expect(result.current.getRenderCount()).toBe(1);
    expect(result.current.getRerenderCount()).toBe(0);
  });

  it("reports watched value changes on rerender", () => {
    const onRender = jest.fn();
    const { result, rerender } = renderHook<
      UseRenderDebuggerResult,
      ValueProps<string>
    >(
      ({ value }) =>
        useRenderDebugger(
          "DebugComponent",
          { value },
          { log: false, onRender },
        ),
      { initialProps: { value: "before" } },
    );

    rerender({ value: "after" });

    expect(onRender).toHaveBeenCalledTimes(2);
    expect(onRender).toHaveBeenLastCalledWith(
      expect.objectContaining({
        renderCount: 2,
        rerenderCount: 1,
        reason: "watched-values-changed",
        changes: [
          {
            key: "value",
            source: "watched",
            path: "value",
            previousValue: "before",
            currentValue: "after",
            changeType: "changed",
          },
        ],
      }),
    );
    expect(result.current.getHistory()).toEqual([
      expect.objectContaining({ reason: "initial-render" }),
      expect.objectContaining({ reason: "watched-values-changed" }),
    ]);
  });

  it("marks rerenders with unchanged watched values as untracked", () => {
    const onRender = jest.fn();
    const { rerender } = renderHook<UseRenderDebuggerResult, ValueProps>(
      ({ value }) =>
        useRenderDebugger(
          "DebugComponent",
          { value },
          { log: false, onRender },
        ),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 1 });

    expect(onRender).toHaveBeenLastCalledWith(
      expect.objectContaining({
        renderCount: 2,
        rerenderCount: 1,
        reason: "untracked-render",
        changes: [],
      }),
    );
  });

  it("reports individual prop changes from the props group", () => {
    const onRender = jest.fn();
    const { rerender } = renderHook<UseRenderDebuggerResult, PlayerProps>(
      ({ channelId, contentType }) =>
        useRenderDebugger(
          "DebugComponent",
          {
            props: {
              channelId,
              contentType,
            },
          },
          { log: false, onRender },
        ),
      { initialProps: { channelId: "one", contentType: "live" } },
    );

    rerender({ channelId: "two", contentType: "live" });

    expect(onRender).toHaveBeenLastCalledWith(
      expect.objectContaining({
        renderCount: 2,
        rerenderCount: 1,
        reason: "watched-values-changed",
        changes: [
          {
            key: "channelId",
            source: "prop",
            path: "prop.channelId",
            previousValue: "one",
            currentValue: "two",
            changeType: "changed",
          },
        ],
      }),
    );
  });

  it("honors custom equality for watched values", () => {
    const onRender = jest.fn();
    const { rerender } = renderHook<UseRenderDebuggerResult, WatchedProps>(
      ({ watched }) =>
        useRenderDebugger("DebugComponent", watched, {
          log: false,
          onRender,
          areEqual: (previousValue, currentValue, key) =>
            key === "item" &&
            typeof previousValue === "object" &&
            previousValue !== null &&
            typeof currentValue === "object" &&
            currentValue !== null &&
            "id" in previousValue &&
            "id" in currentValue &&
            previousValue.id === currentValue.id,
        }),
      { initialProps: { watched: { item: { id: "one" } } } },
    );

    rerender({ watched: { item: { id: "one" } } });

    expect(onRender).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: "untracked-render",
        changes: [],
      }),
    );
  });

  it("can skip logging the initial render", () => {
    const onRender = jest.fn();
    const { rerender } = renderHook<UseRenderDebuggerResult, ValueProps>(
      ({ value }) =>
        useRenderDebugger(
          "DebugComponent",
          { value },
          {
            includeInitialRender: false,
            log: false,
            onRender,
          },
        ),
      { initialProps: { value: 1 } },
    );

    expect(onRender).not.toHaveBeenCalled();

    rerender({ value: 2 });

    expect(onRender).toHaveBeenCalledTimes(1);
    expect(onRender).toHaveBeenLastCalledWith(
      expect.objectContaining({
        renderCount: 2,
        rerenderCount: 1,
        reason: "watched-values-changed",
      }),
    );
  });

  it("keeps history within the configured limit", () => {
    const { result, rerender } = renderHook<
      UseRenderDebuggerResult,
      ValueProps
    >(
      ({ value }) =>
        useRenderDebugger(
          "DebugComponent",
          { value },
          {
            historyLimit: 2,
            log: false,
          },
        ),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 2 });
    rerender({ value: 3 });

    const history = result.current.getHistory();

    expect(history).toHaveLength(2);
    expect(history.map((event: RenderDebugEvent) => event.renderCount)).toEqual(
      [2, 3],
    );
  });

  it("does not report renders while disabled", () => {
    const onRender = jest.fn();
    const { result, rerender } = renderHook<
      UseRenderDebuggerResult,
      ValueProps
    >(
      ({ value }) =>
        useRenderDebugger(
          "DebugComponent",
          { value },
          {
            enabled: false,
            log: false,
            onRender,
          },
        ),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 2 });

    expect(onRender).not.toHaveBeenCalled();
    expect(result.current.getRenderCount()).toBe(0);
    expect(result.current.getHistory()).toEqual([]);
  });

  it("resets render counts and history", () => {
    const { result, rerender } = renderHook<
      UseRenderDebuggerResult,
      ValueProps
    >(
      ({ value }) =>
        useRenderDebugger("DebugComponent", { value }, { log: false }),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 2 });
    result.current.reset();

    expect(result.current.getRenderCount()).toBe(0);
    expect(result.current.getRerenderCount()).toBe(0);
    expect(result.current.getHistory()).toEqual([]);
  });
});
