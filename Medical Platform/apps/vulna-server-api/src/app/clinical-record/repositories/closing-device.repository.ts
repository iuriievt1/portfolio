import type { ClinicalStation } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type { Executor } from "../../../libs/database/database.service"
import type { ClosingDeviceRow } from "../types/clinical-record.types"

// ADR-050, integrace-dicom.md 5.9
@Injectable()
export class ClosingDeviceRepository {
	async stationOf(sql: Executor, deviceId: string): Promise<ClinicalStation | undefined> {
		const [row] = await sql<ClosingDeviceRow[]>`SELECT id, model FROM device WHERE id = ${deviceId}`
		return row === undefined ? undefined : { deviceId: row.id, model: row.model }
	}
}
