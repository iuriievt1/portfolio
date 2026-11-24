import type { ClinicalFileRendition, ClinicalRecordStorePort } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import type { ConfirmedRenditionRow } from "../types/clinical-record.types"
import { attachmentHashOf } from "../utils/attachment-hash"

// CAP-021-R36, CAP-021-R37, CAP-021-R39, integrace-dicom.md 5 attachment-sha256
@Injectable()
export class ClinicalRenditionService {
	private readonly logger = new Logger(ClinicalRenditionService.name)

	constructor(private readonly binaries: BinaryObjectService) {}

	async renditionOf(
		row: ConfirmedRenditionRow,
		contentType: string,
		store: ClinicalRecordStorePort,
	): Promise<ClinicalFileRendition> {
		return {
			binaryId: row.clinical_record_binary_id,
			contentType,
			sizeBytes: row.size_bytes,
			sha1Base64: await this.attachmentHashOf(row, store),
			sha256: row.sha256,
		}
	}

	// CAP-021-R37, CAP-026-R18, ADR-050 bod 11
	private async attachmentHashOf(row: ConfirmedRenditionRow, store: ClinicalRecordStorePort): Promise<string> {
		if (await this.isInBuffer(row)) {
			return attachmentHashOf(await this.binaries.read(row.binary_object_id))
		}
		return await store.attachmentHashOf(row.clinical_record_binary_id)
	}

	// CAP-021-R35, CAP-021-R36
	private async isInBuffer(row: ConfirmedRenditionRow): Promise<boolean> {
		if (row.buffer_deleted_at !== null) {
			return false
		}
		if (await this.binaries.isKept(row.binary_object_id)) {
			return true
		}
		this.logger.warn(`The buffer holds no bytes of binary object ${row.binary_object_id}; the store hashes them`)
		return false
	}
}
