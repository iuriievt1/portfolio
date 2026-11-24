type MaybeError = string | null | undefined;

export function useFirstError(...errors: MaybeError[]): string | null {
  return errors.find(Boolean) ?? null;
}
