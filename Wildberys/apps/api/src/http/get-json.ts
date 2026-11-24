/** What a service answered: the status and, when the status says success, the JSON of the body. */
export interface JsonAnswer {
  readonly status: number;
  readonly ok: boolean;
  readonly body: unknown;
}

/**
 * Asks a service outside the API for JSON and waits no longer than the given time.
 * Throws when the service does not answer in time or answers a success with something that is not JSON.
 */
export async function getJson(url: string, timeoutMilliseconds: number): Promise<JsonAnswer> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMilliseconds),
  });

  return {
    status: response.status,
    ok: response.ok,
    body: response.ok ? ((await response.json()) as unknown) : undefined,
  };
}
