/** What a server action tells the form: it worked, or the stable code of what went wrong. */
export type ActionResult<Value = undefined> =
  { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly code: string };

export const done: ActionResult = { ok: true, value: undefined };

/** For a server action that got something else than it expects from the browser. */
export const invalidInput = { ok: false, code: 'VALIDATION_FAILED' } as const;

/** The stable code of an API error, or a code of our own when the API gave none. */
export function failure(error: unknown): { readonly ok: false; readonly code: string } {
  return {
    ok: false,
    code:
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : 'UNKNOWN',
  };
}

/** For a call that returns nothing: did the API answer that it worked? */
export function succeeded(result: { readonly response?: Response }): boolean {
  return result.response?.ok === true;
}
