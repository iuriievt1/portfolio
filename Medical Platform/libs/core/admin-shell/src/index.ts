/**
 * @ansora/core-admin — the shell of the web administration ✓ ADR-007 ř. 24.
 *
 * A skeleton only; **the UI is not specified** ✓ `docs/spec/architektura.md` kap. 2.
 * The API process hosts the administration ✓ NAB-305, NAB-324 — it is a static build, not
 * another process.
 *
 * The administration session is **its own session, bound to the browser** and separate from the
 * mobile session; signing requests with the device key does not apply here
 * ✓ `docs/spec/administrace-model-a-api.md` kap. 3.
 */
export * from "./session"
