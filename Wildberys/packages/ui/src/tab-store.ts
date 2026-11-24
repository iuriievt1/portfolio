import { useSyncExternalStore } from 'react';

interface TabStoreOptions<Value> {
  /** The name of the value in the storage of the tab. */
  readonly storageKey: string;
  /** Checks what was read from the storage. Returns nothing for a value that is not of the right shape. */
  readonly toValue: (stored: unknown) => Value | undefined;
  /** For a value that ends with time: says whether it is still good. */
  readonly isCurrent?: (value: Value) => boolean;
}

export interface TabStore<Value> {
  /** Keeps the value, or forgets it, and draws again whatever shows it. */
  readonly save: (value: Value | undefined) => void;
  /**
   * Makes the new value from the one kept now, not from the one a component drew last.
   * For a change that comes after waiting, for example when an upload ends.
   */
  readonly change: (update: (current: Value | undefined) => Value | undefined) => void;
  /** Forgets the value without drawing anything again. */
  readonly forget: () => void;
  /** The value kept in this tab, if there is one. */
  readonly useValue: () => Value | undefined;
}

/**
 * A value kept in the tab's own storage, so it survives a reload of the page and a change
 * of language. It goes away when the tab is closed.
 */
export function createTabStore<Value>({
  storageKey,
  toValue,
  isCurrent,
}: TabStoreOptions<Value>): TabStore<Value> {
  const listeners = new Set<() => void>();
  let cachedText: string | null = null;
  let cachedValue: Value | undefined;

  function parse(text: string | null): Value | undefined {
    if (text === null) {
      return undefined;
    }

    try {
      return toValue(JSON.parse(text));
    } catch {
      return undefined;
    }
  }

  function read(): Value | undefined {
    const text = sessionStorage.getItem(storageKey);

    // React needs the same object while nothing changed, so the last answer is kept.
    if (text !== cachedText) {
      cachedText = text;
      cachedValue = parse(text);
    }

    return cachedValue !== undefined && isCurrent?.(cachedValue) === false
      ? undefined
      : cachedValue;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function save(value: Value | undefined): void {
    if (value === undefined) {
      sessionStorage.removeItem(storageKey);
    } else {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    }

    for (const listener of listeners) {
      listener();
    }
  }

  function change(update: (current: Value | undefined) => Value | undefined): void {
    save(update(read()));
  }

  function forget(): void {
    sessionStorage.removeItem(storageKey);
  }

  function useValue(): Value | undefined {
    // The server does not know the tab's storage: the page first renders without it.
    return useSyncExternalStore(subscribe, read, () => undefined);
  }

  return { save, change, forget, useValue };
}
