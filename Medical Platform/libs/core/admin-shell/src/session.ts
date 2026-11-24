/**
 * The administration session ✓ `docs/spec/administrace-model-a-api.md` kap. 3.
 *
 * Separate from the mobile session; the browser holds no device registration key, so the
 * device proof from ADR-013 does not apply in the administration.
 */
export interface AdministrationSession {
	userId: string
	roles: readonly string[]
	departments: readonly string[]
	validUntil: string
}

export interface AdministrationClient {
	/** Base path of the administration API. Contract: `docs/spec/api/administration.yaml`. */
	baseUrl: string
}
