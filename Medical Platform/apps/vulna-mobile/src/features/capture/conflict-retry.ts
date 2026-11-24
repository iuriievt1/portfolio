import { ERROR_CODE } from "@ansora/contracts"
import type { AcquisitionDraft } from "../../api/acquisitions"
import { errorCodeOf } from "../../api/api-error"

export const CONFLICT_RETRY_ATTEMPTS = 5

export interface ConflictRetry {
	isConflict: (error: unknown) => boolean
	refresh: () => Promise<AcquisitionDraft>
	isRetryable: (fresh: AcquisitionDraft) => boolean | Promise<boolean>
}

// CAP-021-R32
export function isVersionConflict(error: unknown): boolean {
	return errorCodeOf(error) === ERROR_CODE.ACQUISITION_VERSION_CONFLICT
}

// CAP-021-R32, CAP-015-R35, E115
export async function retryAfterConflict<T>(
	known: AcquisitionDraft,
	work: (draft: AcquisitionDraft) => Promise<T>,
	retry: ConflictRetry,
): Promise<T> {
	let current = known
	for (let attempt = 1; ; attempt += 1) {
		try {
			return await work(current)
		} catch (error) {
			if (!retry.isConflict(error) || attempt === CONFLICT_RETRY_ATTEMPTS) {
				throw error
			}
			const fresh = await retry.refresh()
			if (fresh.version === current.version || !(await retry.isRetryable(fresh))) {
				throw error
			}
			current = fresh
		}
	}
}
