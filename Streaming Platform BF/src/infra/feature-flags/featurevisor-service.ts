import { createInstance, type LogLevel } from "@featurevisor/sdk";
import type { Context, DatafileContent } from "@featurevisor/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type FeatureFlagMap = Record<string, boolean>;

export type FeaturevisorContext = Context;
type FeaturevisorDatafile = DatafileContent | string;

export type FeaturevisorDatafileFetchOptions = {
  url: string;
  timeoutMs?: number;
  useCache?: boolean;
  cacheMaxAgeMs?: number;
  useConditionalRequest?: boolean;
};

export type FeaturevisorDatafileFetchResult = {
  status:
    | "applied-remote"
    | "applied-cache"
    | "not-modified"
    | "invalid-remote"
    | "error";
  source?: "remote" | "cache";
};

export type FeaturevisorInit = {
  datafile?: FeaturevisorDatafile;
  context?: FeaturevisorContext;
  logLevel?: LogLevel;
  overrides?: FeatureFlagMap;
};

type FeaturevisorInstance = ReturnType<typeof createInstance>;
type FeaturevisorVariation = ReturnType<FeaturevisorInstance["getVariation"]>;
type FeaturevisorVariableValue = ReturnType<
  FeaturevisorInstance["getVariable"]
>;
type FeaturevisorEvaluations = ReturnType<
  FeaturevisorInstance["getAllEvaluations"]
>;
type FeaturevisorSubscriber = () => void;

const STORAGE_KEYS = {
  datafile: "featurevisor:datafile",
  datafileEtag: "featurevisor:datafileEtag",
  datafileFetchedAt: "featurevisor:datafileFetchedAt",
};

/**
 * Manages the local Featurevisor SDK instance, cached datafiles, and refreshes.
 */
export class FeaturevisorFlagService {
  private instance: FeaturevisorInstance | null = null;

  private listeners = new Set<FeaturevisorSubscriber>();

  private overrides: FeatureFlagMap = {};

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  private hasDatafile = false;

  private logLevel?: LogLevel;

  private snapshotVersion = 0;

  subscribe = (listener: FeaturevisorSubscriber) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshotVersion;

  init({ datafile, context, logLevel, overrides }: FeaturevisorInit = {}) {
    const shouldNotify = Boolean(datafile || context || logLevel || overrides);

    if (logLevel) {
      this.logLevel = logLevel;
    }

    if (this.instance) {
      if (logLevel) {
        this.instance.setLogLevel(logLevel);
      }

      if (context) {
        this.instance.setContext(context);
      }

      if (datafile) {
        this.instance.setDatafile(datafile);
      }
    } else if (datafile || context) {
      this.instance = createInstance(
        this.buildInstanceOptions({ datafile, context }),
      );
    }

    if (datafile) {
      this.hasDatafile = true;
    }

    if (overrides) {
      this.overrides = overrides;
    }

    if (shouldNotify) {
      this.notifySubscribers();
    }
  }

  setOverrides(overrides: FeatureFlagMap) {
    this.overrides = overrides;
    this.notifySubscribers();
  }

  setDatafile(datafile: FeaturevisorDatafile) {
    if (!this.instance) {
      this.instance = createInstance(this.buildInstanceOptions({ datafile }));
      this.hasDatafile = true;
      this.notifySubscribers();
      return;
    }

    this.instance.setDatafile(datafile);
    this.hasDatafile = true;
    this.notifySubscribers();
  }

  setContext(context: FeaturevisorContext, replace = false) {
    if (!this.instance) {
      this.instance = createInstance(this.buildInstanceOptions({ context }));
      this.notifySubscribers();
      return;
    }

    this.instance.setContext(context, replace);
    this.notifySubscribers();
  }

  async hydrateFromCache({
    cacheMaxAgeMs = Number.POSITIVE_INFINITY,
  }: {
    cacheMaxAgeMs?: number;
  } = {}) {
    const cached = await this.getCachedDatafile();

    if (!(cached && this.isCacheFresh(cached.fetchedAt, cacheMaxAgeMs))) {
      return false;
    }

    this.setDatafile(cached.datafile);
    return true;
  }

  async refreshDatafile({
    url,
    timeoutMs = 5000,
    useCache = true,
    cacheMaxAgeMs = Number.POSITIVE_INFINITY,
    useConditionalRequest = false,
  }: FeaturevisorDatafileFetchOptions): Promise<FeaturevisorDatafileFetchResult> {
    const cached = useCache ? await this.getCachedDatafile() : null;
    const cachedEtag = cached?.etag;
    const freshCached =
      cached && this.isCacheFresh(cached.fetchedAt, cacheMaxAgeMs)
        ? cached
        : null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {};

      if (useConditionalRequest && cachedEtag) {
        headers["If-None-Match"] = cachedEtag;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (response.status === 304) {
        if (cached) {
          // The CDN has revalidated the cached ETag, so we can safely reuse
          // the existing datafile and refresh its fetched-at timestamp.
          const etag = response.headers.get("ETag") ?? cachedEtag;
          await this.touchCachedDatafile(etag);
          this.setDatafile(cached.datafile);
          return { status: "not-modified", source: "cache" };
        }

        return { status: "not-modified" };
      }

      if (!response.ok) {
        if (freshCached) {
          this.setDatafile(freshCached.datafile);
          return { status: "applied-cache", source: "cache" };
        }

        return { status: "error" };
      }

      const datafile = (await response.json()) as unknown;

      if (!datafile || typeof datafile !== "object") {
        if (freshCached) {
          this.setDatafile(freshCached.datafile);
          return { status: "invalid-remote", source: "cache" };
        }

        return { status: "invalid-remote" };
      }

      const etag = response.headers.get("ETag") ?? undefined;
      await this.saveCachedDatafile(datafile as DatafileContent, etag);
      this.setDatafile(datafile as DatafileContent);

      return { status: "applied-remote", source: "remote" };
    } catch {
      if (freshCached) {
        this.setDatafile(freshCached.datafile);
        return { status: "applied-cache", source: "cache" };
      }

      return { status: "error" };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  startAutoRefresh(
    options: FeaturevisorDatafileFetchOptions & { refreshIntervalMs: number },
  ) {
    if (this.refreshTimer != null) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      this.refreshDatafile(options)
        .then(() => undefined)
        .catch(() => undefined);
    }, options.refreshIntervalMs);
  }

  stopAutoRefresh() {
    if (this.refreshTimer != null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /** Evaluates a flag, using its fallback when the datafile or definition is missing. */
  isEnabled(key: string, context: FeaturevisorContext = {}, fallback = false) {
    if (Object.hasOwn(this.overrides, key)) {
      return this.overrides[key];
    }

    if (!(this.instance && this.hasDatafile && this.instance.getFeature(key))) {
      return fallback;
    }

    return this.instance.isEnabled(key, context);
  }

  getVariation(
    key: string,
    context: FeaturevisorContext = {},
  ): FeaturevisorVariation | null {
    if (!(this.instance && this.hasDatafile)) {
      return null;
    }

    return this.instance.getVariation(key, context);
  }

  getVariable(
    key: string,
    variableKey: string,
    context: FeaturevisorContext = {},
  ): FeaturevisorVariableValue | undefined {
    if (!(this.instance && this.hasDatafile)) {
      return undefined;
    }

    return this.instance.getVariable(key, variableKey, context);
  }

  getAllEvaluations(
    context: FeaturevisorContext = {},
  ): FeaturevisorEvaluations {
    if (!(this.instance && this.hasDatafile)) {
      return {} as FeaturevisorEvaluations;
    }

    return this.instance.getAllEvaluations(context);
  }

  private async getCachedDatafile(): Promise<{
    datafile: FeaturevisorDatafile;
    fetchedAt: number;
    etag?: string;
  } | null> {
    // AsyncStorage v3 removed `multiGet` from the public API, so we stick to
    // single-key reads that work across legacy and current implementations.
    const [rawDatafile, rawFetchedAt, rawEtag] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.datafile),
      AsyncStorage.getItem(STORAGE_KEYS.datafileFetchedAt),
      AsyncStorage.getItem(STORAGE_KEYS.datafileEtag),
    ]);

    if (!(rawDatafile && rawFetchedAt)) {
      return null;
    }

    try {
      const datafile = JSON.parse(rawDatafile) as FeaturevisorDatafile;
      const fetchedAt = Number(rawFetchedAt);

      if (
        !datafile ||
        typeof datafile !== "object" ||
        Number.isNaN(fetchedAt)
      ) {
        return null;
      }

      return rawEtag == null
        ? {
            datafile,
            fetchedAt,
          }
        : {
            datafile,
            fetchedAt,
            etag: rawEtag,
          };
    } catch {
      return null;
    }
  }

  private async saveCachedDatafile(datafile: DatafileContent, etag?: string) {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.datafile, JSON.stringify(datafile)),
      AsyncStorage.setItem(STORAGE_KEYS.datafileFetchedAt, String(Date.now())),
      etag
        ? AsyncStorage.setItem(STORAGE_KEYS.datafileEtag, etag)
        : AsyncStorage.removeItem(STORAGE_KEYS.datafileEtag),
    ]);
  }

  private async touchCachedDatafile(etag?: string) {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.datafileFetchedAt, String(Date.now())),
      etag
        ? AsyncStorage.setItem(STORAGE_KEYS.datafileEtag, etag)
        : Promise.resolve(),
    ]);
  }

  private isCacheFresh(fetchedAt: number, maxAgeMs: number) {
    if (!Number.isFinite(maxAgeMs)) {
      return true;
    }

    return Date.now() - fetchedAt <= maxAgeMs;
  }

  private buildInstanceOptions({
    context,
    datafile,
  }: {
    context?: FeaturevisorContext | undefined;
    datafile?: FeaturevisorDatafile | undefined;
  }) {
    return {
      ...(datafile ? { datafile } : {}),
      ...(context ? { context } : {}),
      ...(this.logLevel ? { logLevel: this.logLevel } : {}),
    };
  }

  private notifySubscribers() {
    this.snapshotVersion += 1;

    this.listeners.forEach((listener) => {
      listener();
    });
  }
}

export const featurevisorService = new FeaturevisorFlagService();
