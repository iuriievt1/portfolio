import { useCallback, useEffect, useRef } from "react";

type RenderDebugValues = Record<string, unknown>;

type RenderDebugSource = "prop" | "state" | "context" | "watched";
type RenderDebugGroupName = "props" | "state" | "context" | "watched";
type RenderDebugGroups = Partial<
  Record<RenderDebugGroupName, RenderDebugValues>
>;
type RenderDebugWatchedValues = RenderDebugValues | RenderDebugGroups;

export type RenderDebugChange = {
  key: string;
  source: RenderDebugSource;
  path: string;
  previousValue: unknown;
  currentValue: unknown;
  changeType: "added" | "removed" | "changed";
};

export type RenderDebugReason =
  | "initial-render"
  | "watched-values-changed"
  | "untracked-render";

export type RenderDebugEvent = {
  componentName: string;
  renderCount: number;
  rerenderCount: number;
  reason: RenderDebugReason;
  changes: RenderDebugChange[];
  timestamp: number;
};

export type RenderDebugLogger = {
  log: (...args: unknown[]) => void;
  groupCollapsed?: (...args: unknown[]) => void;
  groupEnd?: () => void;
};

export type UseRenderDebuggerOptions = {
  enabled?: boolean;
  log?: boolean;
  logger?: RenderDebugLogger;
  includeInitialRender?: boolean;
  historyLimit?: number;
  areEqual?: (
    previousValue: unknown,
    currentValue: unknown,
    key: string,
    source: RenderDebugSource,
  ) => boolean;
  onRender?: (event: RenderDebugEvent) => void;
};

export type UseRenderDebuggerResult = {
  getRenderCount: () => number;
  getRerenderCount: () => number;
  getHistory: () => RenderDebugEvent[];
  reset: () => void;
};

const DEFAULT_HISTORY_LIMIT = 100;

const defaultLogger: RenderDebugLogger = console;

const defaultAreEqual = (
  previousValue: unknown,
  currentValue: unknown,
): boolean => Object.is(previousValue, currentValue);

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

type NormalizedRenderDebugValue = {
  key: string;
  source: RenderDebugSource;
  path: string;
  value: unknown;
};

type NormalizedRenderDebugValues = Record<string, NormalizedRenderDebugValue>;

const SOURCE_GROUPS = {
  props: "prop",
  state: "state",
  context: "context",
  watched: "watched",
} as const satisfies Record<RenderDebugGroupName, RenderDebugSource>;
const SOURCE_GROUP_NAMES = Object.keys(SOURCE_GROUPS) as RenderDebugGroupName[];

function isRecord(value: unknown): value is RenderDebugValues {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSourceGroups(
  watchedValues: RenderDebugWatchedValues,
): watchedValues is RenderDebugGroups {
  return SOURCE_GROUP_NAMES.some(
    (groupName) =>
      Object.hasOwn(watchedValues, groupName) &&
      isRecord(watchedValues[groupName]),
  );
}

function normalizeWatchedValues(
  watchedValues: RenderDebugWatchedValues,
): NormalizedRenderDebugValues {
  const normalizedValues: NormalizedRenderDebugValues = {};

  if (!hasSourceGroups(watchedValues)) {
    for (const [key, value] of Object.entries(watchedValues)) {
      normalizedValues[`watched:${key}`] = {
        key,
        source: "watched",
        path: key,
        value,
      };
    }

    return normalizedValues;
  }

  for (const groupName of SOURCE_GROUP_NAMES) {
    const groupValues = watchedValues[groupName];
    const source = SOURCE_GROUPS[groupName];

    if (!groupValues) {
      continue;
    }

    for (const [key, value] of Object.entries(groupValues)) {
      normalizedValues[`${source}:${key}`] = {
        key,
        source,
        path: `${source}.${key}`,
        value,
      };
    }
  }

  return normalizedValues;
}

function getChanges(
  previousValues: NormalizedRenderDebugValues | null,
  currentValues: NormalizedRenderDebugValues,
  areEqual: NonNullable<UseRenderDebuggerOptions["areEqual"]>,
) {
  if (!previousValues) {
    return [];
  }

  const previousKeys = Object.keys(previousValues);
  const currentKeys = Object.keys(currentValues);
  const keys = new Set([...previousKeys, ...currentKeys]);
  const changes: RenderDebugChange[] = [];

  keys.forEach((key) => {
    const hasPreviousValue = Object.hasOwn(previousValues, key);
    const hasCurrentValue = Object.hasOwn(currentValues, key);
    const previousValue = previousValues[key]?.value;
    const currentValue = currentValues[key]?.value;
    const valueMeta = currentValues[key] ?? previousValues[key];

    if (!valueMeta) {
      return;
    }

    if (!hasPreviousValue && hasCurrentValue) {
      changes.push({
        key: valueMeta.key,
        source: valueMeta.source,
        path: valueMeta.path,
        previousValue,
        currentValue,
        changeType: "added",
      });
      return;
    }

    if (hasPreviousValue && !hasCurrentValue) {
      changes.push({
        key: valueMeta.key,
        source: valueMeta.source,
        path: valueMeta.path,
        previousValue,
        currentValue,
        changeType: "removed",
      });
      return;
    }

    if (
      !areEqual(previousValue, currentValue, valueMeta.key, valueMeta.source)
    ) {
      changes.push({
        key: valueMeta.key,
        source: valueMeta.source,
        path: valueMeta.path,
        previousValue,
        currentValue,
        changeType: "changed",
      });
    }
  });

  return changes;
}

function logRenderEvent(event: RenderDebugEvent, logger: RenderDebugLogger) {
  const label = `[render-debug] ${event.componentName} #${event.renderCount}: ${event.reason}`;

  if (logger.groupCollapsed) {
    logger.groupCollapsed(label);
    logger.log("rerenderCount", event.rerenderCount);
    logger.log("changes", event.changes);
    logger.groupEnd?.();
    return;
  }

  logger.log(label, event);
}

/**
 * Tracks committed renders for a component and reports which watched values
 * changed between commits. Pass props, state, context, or derived values into
 * `watchedValues` while debugging a noisy component.
 */
export default function useRenderDebugger(
  componentName: string,
  watchedValues: RenderDebugWatchedValues = {},
  {
    enabled = !isProduction,
    log = !isTest,
    logger = defaultLogger,
    includeInitialRender = true,
    historyLimit = DEFAULT_HISTORY_LIMIT,
    areEqual = defaultAreEqual,
    onRender,
  }: UseRenderDebuggerOptions = {},
): UseRenderDebuggerResult {
  const renderCountRef = useRef(0);
  const previousValuesRef = useRef<NormalizedRenderDebugValues | null>(null);
  const historyRef = useRef<RenderDebugEvent[]>([]);

  useEffect(() => {
    const normalizedWatchedValues = normalizeWatchedValues(watchedValues);

    if (!enabled) {
      previousValuesRef.current = normalizedWatchedValues;
      return;
    }

    const nextRenderCount = renderCountRef.current + 1;
    const changes = getChanges(
      previousValuesRef.current,
      normalizedWatchedValues,
      areEqual,
    );
    let reason: RenderDebugReason = "untracked-render";

    if (nextRenderCount === 1) {
      reason = "initial-render";
    } else if (changes.length > 0) {
      reason = "watched-values-changed";
    }

    const event: RenderDebugEvent = {
      componentName,
      renderCount: nextRenderCount,
      rerenderCount: Math.max(0, nextRenderCount - 1),
      reason,
      changes,
      timestamp: Date.now(),
    };

    renderCountRef.current = nextRenderCount;
    previousValuesRef.current = normalizedWatchedValues;

    if (includeInitialRender || reason !== "initial-render") {
      historyRef.current = [...historyRef.current, event].slice(-historyLimit);
      onRender?.(event);

      if (log) {
        logRenderEvent(event, logger);
      }
    }
  });

  const getRenderCount = useCallback(() => renderCountRef.current, []);
  const getRerenderCount = useCallback(
    () => Math.max(0, renderCountRef.current - 1),
    [],
  );
  const getHistory = useCallback(() => [...historyRef.current], []);
  const reset = useCallback(() => {
    renderCountRef.current = 0;
    previousValuesRef.current = null;
    historyRef.current = [];
  }, []);

  return {
    getRenderCount,
    getRerenderCount,
    getHistory,
    reset,
  };
}
