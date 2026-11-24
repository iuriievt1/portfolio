import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { AcquisitionUpdateRequestRow, NewUpdateRequest } from "../types/acquisition.types"

// CAP-021-R29, CAP-021-S23, CAP-021-S24
@Injectable()
export class AcquisitionUpdateRequestRepository {
	async findByKey(
		tx: postgres.TransactionSql,
		acquisitionId: string,
		requestKey: string,
	): Promise<AcquisitionUpdateRequestRow | undefined> {
		const [row] = await tx<AcquisitionUpdateRequestRow[]>`
			SELECT body_sha256, response FROM acquisition_update_request
			WHERE acquisition_id = ${acquisitionId} AND request_key = ${requestKey}
		`
		return row
	}

	async insert(tx: postgres.TransactionSql, request: NewUpdateRequest): Promise<void> {
		await tx`
			INSERT INTO acquisition_update_request (acquisition_id, request_key, body_sha256, response)
			VALUES (
				${request.acquisitionId}, ${request.requestKey}, ${request.fingerprint},
				${JSON.stringify(request.response)}::text::jsonb
			)
		`
	}
}
