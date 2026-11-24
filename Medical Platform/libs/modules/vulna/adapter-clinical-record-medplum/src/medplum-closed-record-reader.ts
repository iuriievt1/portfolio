import {
	ClosedRecordConflictError,
	type ClosedRecordReaderPort,
	type StoredScanRecord,
	type StoredWoundRecord,
} from "@ansora/vulna-domain/ports"
import { MedplumClient } from "@medplum/core"
import { signedIn } from "./client-login"
import {
	closedAssessmentQueryOf,
	closedResourceQueryOf,
	storedScanRecordOf,
	storedWoundRecordOf,
	studyIdOfAssessment,
	studyIdOfDocument,
} from "./closed-record-resources"
import { storeErrorOf } from "./failure"
import type { BodyStructure, Condition, DocumentReference, ImagingStudy, Observation } from "./fhir-types"
import { acquisitionFilterOf, bodyStructureIdOf, isAssessment, scannedDocumentQueryOf } from "./history-resources"
import { identifierSystemsOf } from "./identifiers"
import type { MedplumSettings } from "./medplum-clinical-record-store"
import type { ProjectionContext } from "./resource-meta"
import { allPagesOf, ofType } from "./resource-pages"
import { timedFetch } from "./timed-fetch"

export type MedplumClosedRecordSettings = Omit<MedplumSettings, "serverVersion">

// ADR-054 bod 4
const NO_CACHE = 0
// dorucovaci-jadro.md 4
const NO_RETRIES = 0

// ADR-054 bod 4, CAP-012-R30, CAP-021-R27, integrace-dicom.md 2
export class MedplumClosedRecordReader implements ClosedRecordReaderPort {
	private readonly client: MedplumClient
	private readonly context: ProjectionContext

	constructor(private readonly settings: MedplumClosedRecordSettings) {
		this.context = { systems: identifierSystemsOf(settings.canonicalBase), instanceBase: settings.instanceBaseUri }
		this.client = new MedplumClient({
			baseUrl: settings.baseUrl,
			fetch: timedFetch(settings.fetch ?? fetch),
			cacheTime: NO_CACHE,
			maxRetries: NO_RETRIES,
		})
	}

	async closedWoundRecord(acquisitionId: string): Promise<StoredWoundRecord | undefined> {
		return await this.read(`reading the closed wound record ${acquisitionId}`, async () => {
			const found = await allPagesOf(this.client, "Observation", closedAssessmentQueryOf(this.context, acquisitionId))
			const assessment = this.onlyOf(ofType<Observation>(found, "Observation").filter(isAssessment), acquisitionId)
			if (assessment === undefined) {
				return undefined
			}
			const resources = {
				assessment,
				conditions: ofType<Condition>(found, "Condition"),
				bodyStructures: await this.bodyStructuresOf(assessment),
				study: await this.study(studyIdOfAssessment(assessment)),
			}
			return storedWoundRecordOf(acquisitionId, resources, this.context)
		})
	}

	async closedScanRecord(acquisitionId: string): Promise<StoredScanRecord | undefined> {
		return await this.read(`reading the closed scan record ${acquisitionId}`, async () => {
			const query = scannedDocumentQueryOf(this.context, acquisitionFilterOf(this.context, acquisitionId))
			const documents = ofType<DocumentReference>(
				await allPagesOf(this.client, "DocumentReference", query),
				"DocumentReference",
			)
			const document = this.onlyOf(documents, acquisitionId)
			if (document === undefined) {
				return undefined
			}
			const study = await this.study(studyIdOfDocument(document))
			return storedScanRecordOf(acquisitionId, document, study, this.context)
		})
	}

	private async read<T>(operation: string, work: () => Promise<T>): Promise<T> {
		try {
			await signedIn(this.client, this.settings)
			return await work()
		} catch (error) {
			if (error instanceof ClosedRecordConflictError) {
				throw error
			}
			throw storeErrorOf(error, operation)
		}
	}

	// ADR-054 bod 4, integrace-dicom.md 2
	private onlyOf<T>(resources: readonly T[], acquisitionId: string): T | undefined {
		if (resources.length > 1) {
			throw new ClosedRecordConflictError(`the store holds ${resources.length} closed records ${acquisitionId}`)
		}
		return resources[0]
	}

	private async bodyStructuresOf(assessment: Observation): Promise<BodyStructure[]> {
		const bodyStructureId = bodyStructureIdOf(assessment)
		if (bodyStructureId === undefined) {
			return []
		}
		const query = closedResourceQueryOf(this.context, bodyStructureId)
		return ofType<BodyStructure>(await allPagesOf(this.client, "BodyStructure", query), "BodyStructure")
	}

	private async study(studyResourceId: string | undefined): Promise<ImagingStudy | undefined> {
		if (studyResourceId === undefined) {
			return undefined
		}
		const query = closedResourceQueryOf(this.context, studyResourceId)
		const [study] = ofType<ImagingStudy>(await allPagesOf(this.client, "ImagingStudy", query), "ImagingStudy")
		return study
	}
}
