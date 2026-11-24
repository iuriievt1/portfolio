import { ERROR_CODE, RELEASE_KIND } from "@ansora/contracts"
import { MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { messageOf } from "../../../libs/common/utils/error-message"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import { ClinicalRecordStoreService } from "../../clinical-record/services/clinical-record-store.service"
import { ViewerService } from "../../clinical-record/services/viewer.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import {
	FILE_OUTCOME,
	IMAGE_LINK_VALIDITY_SECONDS,
	RELEASED_FILE,
	RELEASED_NONE,
	RELEASED_ONE,
} from "../constants/image.constants"
import { StoredFileRepository } from "../repositories/stored-file.repository"
import type { FilePart, FileRequest, ReleasedFile, ReleasedRendition, StoredFileRow } from "../types/image.types"
import { fileOutcomeOf } from "../utils/file-outcome"
import { RecordReleaseService } from "./record-release.service"

// CAP-020-S31
function sourceUnavailable(): ProblemException {
	return new ProblemException(HttpStatus.SERVICE_UNAVAILABLE, ERROR_CODE.IMAGE_SOURCE_UNAVAILABLE)
}

// ADR-053 (doplnění 2026-09-24) bod 1
function linkExpiryOf(now: Date): Date {
	const seconds = Math.floor(now.getTime() / MILLISECONDS_PER_SECOND) + IMAGE_LINK_VALIDITY_SECONDS
	return new Date(seconds * MILLISECONDS_PER_SECOND)
}

// CAP-020-R09, CAP-020-R10, CAP-020-R22, CAP-015-R17, CAP-015-R30, CAP-025-R28, ADR-053 (doplnění 2026-09-24) bod 1, ADR-054 bod 5
@Injectable()
export class FileReleaseService {
	private readonly logger = new Logger(FileReleaseService.name)

	constructor(
		private readonly files: StoredFileRepository,
		private readonly viewers: ViewerService,
		private readonly patients: PatientLookupService,
		private readonly releases: RecordReleaseService,
		private readonly binaries: BinaryObjectService,
		private readonly stores: ClinicalRecordStoreService,
	) {}

	async image(current: CurrentSession, imageId: string, part: FilePart, now: Date): Promise<ReleasedFile> {
		const file = await this.files.image(imageId)
		return await this.release(current, file, { fileId: imageId, part, releaseKind: RELEASE_KIND.IMAGE }, now)
	}

	async documentPage(current: CurrentSession, pageId: string, part: FilePart, now: Date): Promise<ReleasedFile> {
		const file = await this.files.documentPage(pageId)
		return await this.release(current, file, { fileId: pageId, part, releaseKind: RELEASE_KIND.DOCUMENT_PAGE }, now)
	}

	// CAP-020-S29
	private async release(
		current: CurrentSession,
		file: StoredFileRow | undefined,
		request: FileRequest,
		now: Date,
	): Promise<ReleasedFile> {
		const outcome = fileOutcomeOf(file, await this.viewers.viewerOf(current), request.part)
		switch (outcome.kind) {
			case FILE_OUTCOME.NOT_FOUND:
				await this.recordRelease(current, file, request, RELEASED_NONE)
				throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
			case FILE_OUTCOME.GONE:
				await this.recordRelease(current, file, request, RELEASED_NONE)
				throw new ProblemException(HttpStatus.GONE, ERROR_CODE.RESOURCE_NOT_FOUND)
			case FILE_OUTCOME.SOURCE_UNAVAILABLE:
				this.logger.error(`The ${request.part} of the file ${request.fileId} is neither buffered nor confirmed stored`)
				await this.recordRelease(current, file, request, RELEASED_NONE)
				throw sourceUnavailable()
			// CAP-020-R22, CAP-020-S28
			case FILE_OUTCOME.LINK:
				return await this.releaseLink(current, file, request, outcome.clinicalRecordBinaryId, outcome.rendition, now)
			case FILE_OUTCOME.RELEASE:
				if (outcome.clinicalRecordBinaryId !== null && !(await this.binaries.isKept(outcome.binaryObjectId))) {
					this.logger.warn(
						`The buffer holds no ${request.part} of the file ${request.fileId} (binary object ${outcome.binaryObjectId}); it is linked to the store`,
					)
					return await this.releaseLink(current, file, request, outcome.clinicalRecordBinaryId, outcome.rendition, now)
				}
				return await this.releaseBytes(current, file, request, outcome.binaryObjectId, outcome.rendition)
			default:
				return outcome satisfies never
		}
	}

	// CAP-020-R22, CAP-020-S28, CAP-020-S31
	private async releaseLink(
		current: CurrentSession,
		file: StoredFileRow | undefined,
		request: FileRequest,
		clinicalRecordBinaryId: string,
		rendition: ReleasedRendition,
		now: Date,
	): Promise<ReleasedFile> {
		const expiresAt = linkExpiryOf(now)
		const url = await this.linkOf(clinicalRecordBinaryId, expiresAt, request)
		if (url === undefined) {
			await this.recordRelease(current, file, request, RELEASED_NONE)
			throw sourceUnavailable()
		}
		await this.recordRelease(current, file, request, RELEASED_ONE)
		return {
			kind: RELEASED_FILE.LINK,
			link: {
				download_url: url,
				expires_at: expiresAt.toISOString(),
				rendition,
			},
		}
	}

	// CAP-020-R22, CAP-020-S27, CAP-020-S31
	private async releaseBytes(
		current: CurrentSession,
		file: StoredFileRow | undefined,
		request: FileRequest,
		binaryObjectId: string,
		rendition: ReleasedRendition,
	): Promise<ReleasedFile> {
		const bytes = await this.bytesOf(binaryObjectId, request)
		if (bytes === undefined) {
			await this.recordRelease(current, file, request, RELEASED_NONE)
			throw sourceUnavailable()
		}
		await this.recordRelease(current, file, request, RELEASED_ONE)
		return { kind: RELEASED_FILE.BYTES, bytes, rendition }
	}

	// CAP-020-R22, CAP-020-S31
	private async bytesOf(binaryObjectId: string, request: FileRequest): Promise<Buffer | undefined> {
		try {
			return await this.binaries.read(binaryObjectId)
		} catch (error) {
			this.logger.error(
				`The ${request.part} of the file ${request.fileId} (binary object ${binaryObjectId}) cannot be read: ${messageOf(error)}`,
			)
			return undefined
		}
	}

	// CAP-020-R22, CAP-020-S31, ADR-053 (doplnění 2026-09-24) bod 1
	private async linkOf(binaryId: string, expiresAt: Date, request: FileRequest): Promise<string | undefined> {
		const links = await this.stores.links()
		const subject = `link to the ${request.part} of the file ${request.fileId} (binary ${binaryId})`
		if (links === undefined) {
			this.logger.error(`The ${subject} cannot be issued: the clinical record store is not configured`)
			return undefined
		}
		try {
			return await links.downloadLinkOf(binaryId, expiresAt)
		} catch (error) {
			this.stores.reportFailure(subject, error)
			return undefined
		}
	}

	// CAP-025-R28
	private async recordRelease(
		current: CurrentSession,
		file: StoredFileRow | undefined,
		request: FileRequest,
		releasedItemCount: number,
	): Promise<void> {
		await this.releases.record(current, {
			kind: request.releaseKind,
			objectId: request.fileId,
			patient: file === undefined ? undefined : await this.patients.findPatient(file.patient_id),
			encounterId: file?.encounter_id,
			acquisitionId: file?.acquisition_id,
			releasedItemCount,
		})
	}
}
