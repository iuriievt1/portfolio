/**
 * Core ports ✓ ADR-003 ř. 21–22.
 *
 * This barrel is the only thing an adapter may import from the core ✓ ADR-003 ř. 26;
 * gate B15 enforces it ✓ `docs/spec/vydani-sbom-a-brany.md` kap. 2.3.
 */
export * from "./audit-sink.port"
export * from "./binary-store.port"
export * from "./card-identity-resolver.port"
export * from "./identity-provider.port"
