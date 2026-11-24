import { ACQUISITION_KIND } from "@ansora/contracts"
import { type HpkeEnvelope, HpkeError } from "@ansora/core-server"
import { DicomMappingError, dicomImageStreamOf, isJpegStream } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import { HpkeKeyService } from "../../../libs/hpke/hpke-key.service"
import { sha256HexOf } from "../../binary-object/utils/sha256"
import { PART } from "../constants/acquisition-file.constants"
import { RejectedContentError } from "../errors/rejected-content.error"
import type { ContentCheck, OpenedContent, SealedContent } from "../types/acquisition-file.types"

// CAP-021-R21, CAP-021-R07, ADR-015, CAP-009-R13
@Injectable()
export class UploadedContentService {
	constructor(private readonly hpke: HpkeKeyService) {}

	opened(content: SealedContent, check: ContentCheck): OpenedContent {
		const file = this.openedPart(content.file, content.encryption, PART.FILE)
		if (sha256HexOf(file) !== check.sha256) {
			throw new RejectedContentError("the sha256 of the opened file differs from the declared one", false)
		}
		// CAP-015-R04, clinical-workflow.yaml ImageUpload.image, DocumentPageUpload.page
		if (!isJpegStream(file)) {
			throw new RejectedContentError("the opened file is not a JPEG stream", true)
		}
		if (check.kind === ACQUISITION_KIND.PHOTO) {
			this.requireDicomImage(file)
		}
		const thumbnail =
			content.thumbnail === undefined
				? undefined
				: this.openedPart(content.thumbnail, content.thumbnailEncryption, PART.THUMBNAIL)
		return { file, thumbnail }
	}

	// integrace-dicom.md 3.1, clinical-workflow.yaml ImageUpload.image, CAP-015-R04, CAP-015-R14, CAP-021-R07
	private requireDicomImage(file: Buffer): void {
		try {
			dicomImageStreamOf(file)
		} catch (error) {
			if (error instanceof DicomMappingError) {
				throw new RejectedContentError(`the file is not an image the DICOM builder takes: ${error.message}`, true)
			}
			throw error
		}
	}

	private openedPart(bytes: Buffer, envelope: HpkeEnvelope | undefined, part: string): Buffer {
		if (envelope === undefined) {
			return bytes
		}
		try {
			return this.hpke.openEnvelope(envelope, bytes)
		} catch (error) {
			if (error instanceof HpkeError) {
				throw new RejectedContentError(`the ${part} envelope does not open: ${error.message}`, false)
			}
			throw error
		}
	}
}
