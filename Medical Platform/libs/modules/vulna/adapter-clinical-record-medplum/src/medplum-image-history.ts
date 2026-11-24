import {
	ACQUISITION_KIND,
	type AcquisitionOfRecord,
	type ClinicalReader,
	type EncounterResources,
	type HistoryRecords,
	type HistoryScanRecord,
	type HistoryWounds,
	type ImageHistoryPort,
} from "@ansora/vulna-domain/ports"
import { getStatus, MedplumClient, type MedplumRequestOptions, OperationOutcomeError } from "@medplum/core"
import { signedIn } from "./client-login"
import { HTTP_FORBIDDEN, storeErrorOf } from "./failure"
import type { BodyStructure, Condition, DocumentReference, Observation } from "./fhir-types"
import {
	acquisitionFilterOf,
	acquisitionIdsOf,
	assessmentQueryOf,
	bodyStructureIdOf,
	bodyStructureQueryOf,
	clinicalObservationQueryOf,
	closedScansOf,
	closedWoundsOf,
	encounterFilterOf,
	findingFilterOf,
	isAssessment,
	NO_RECORDS,
	patientFilterOf,
	present,
	type SearchQuery,
	scannedDocumentQueryOf,
	studyFilterOf,
	withFindings,
} from "./history-resources"
import { identifierSystemsOf } from "./identifiers"
import type { MedplumSettings } from "./medplum-clinical-record-store"
import type { ProjectionContext } from "./resource-meta"
import { allPagesOf, ofType } from "./resource-pages"
import { readFetch } from "./timed-fetch"

export type MedplumHistorySettings = Omit<MedplumSettings, "serverVersion">

// ADR-053 bod 3
const ON_BEHALF_OF_HEADER = "X-Medplum-On-Behalf-Of"
const MEMBERSHIP_REFERENCE = "ProjectMembership/"
// ADR-053 bod 4
const NO_CACHE = 0
// backend.md 3.1, ADR-050 bod 11
const NO_RETRIES = 0
const NO_WOUNDS: HistoryWounds = { findings: [], wounds: [] }

interface ObservationResources {
	observations: Observation[]
	conditions: Condition[]
}

function isForbidden(error: unknown): boolean {
	return error instanceof OperationOutcomeError && getStatus(error.outcome) === HTTP_FORBIDDEN
}

// ADR-053 bod 3, ADR-054 bod 2, CAP-020-R03, CAP-020-R16
export class MedplumImageHistory implements ImageHistoryPort {
	private readonly client: MedplumClient
	private readonly context: ProjectionContext

	constructor(private readonly settings: MedplumHistorySettings) {
		this.context = { systems: identifierSystemsOf(settings.canonicalBase), instanceBase: settings.instanceBaseUri }
		this.client = new MedplumClient({
			baseUrl: settings.baseUrl,
			fetch: readFetch(settings.fetch ?? fetch, settings.baseUrl),
			cacheTime: NO_CACHE,
			maxRetries: NO_RETRIES,
		})
	}

	async closedWoundsOfPatient(reader: ClinicalReader, patientResourceId: string): Promise<HistoryWounds> {
		const query = clinicalObservationQueryOf(this.context, patientFilterOf(patientResourceId))
		const operation = `reading the closed wounds of patient ${patientResourceId}`
		return await this.read(reader, operation, NO_WOUNDS, (options) => this.woundsOf(query, options))
	}

	async closedScansOfPatient(reader: ClinicalReader, patientResourceId: string): Promise<readonly HistoryScanRecord[]> {
		const query = scannedDocumentQueryOf(this.context, patientFilterOf(patientResourceId))
		const operation = `reading the closed documents of patient ${patientResourceId}`
		return await this.read(reader, operation, [], async (options) =>
			closedScansOf(await this.documents(query, options), this.context),
		)
	}

	async closedAcquisitionsOfEncounters(
		reader: ClinicalReader,
		encounters: readonly EncounterResources[],
	): Promise<readonly string[]> {
		if (encounters.length === 0) {
			return []
		}
		const studies = encounters.map((encounter) => encounter.imagingStudyResourceId).filter(present)
		const operation = `reading the closed records of ${encounters.length} visits`
		return await this.read(reader, operation, [], async (options) => {
			const observations =
				studies.length === 0
					? []
					: (await this.observations(assessmentQueryOf(this.context, studyFilterOf(studies)), options)).observations
			const documents = await this.documents(
				scannedDocumentQueryOf(
					this.context,
					encounterFilterOf(encounters.map((encounter) => encounter.encounterResourceId)),
				),
				options,
			)
			return acquisitionIdsOf(observations, documents, this.context)
		})
	}

	async closedRecordsOfFinding(reader: ClinicalReader, conditionResourceId: string): Promise<HistoryRecords> {
		const operation = `reading the closed records of finding ${conditionResourceId}`
		const query = clinicalObservationQueryOf(this.context, findingFilterOf(conditionResourceId))
		return await this.read(reader, operation, NO_RECORDS, async (options) => ({
			...(await this.woundsOf(query, options)),
			scans: [],
		}))
	}

	async closedRecord(reader: ClinicalReader, acquisition: AcquisitionOfRecord): Promise<HistoryRecords> {
		const filter = acquisitionFilterOf(this.context, acquisition.acquisitionId)
		const operation = `reading the closed record ${acquisition.acquisitionId}`
		return await this.read(reader, operation, NO_RECORDS, async (options) => {
			switch (acquisition.kind) {
				case ACQUISITION_KIND.PHOTO: {
					const { wounds } = await this.woundsOf(withFindings(assessmentQueryOf(this.context, filter)), options)
					return { ...NO_RECORDS, wounds }
				}
				case ACQUISITION_KIND.SCAN: {
					const documents = await this.documents(scannedDocumentQueryOf(this.context, filter), options)
					return { ...NO_RECORDS, scans: closedScansOf(documents, this.context) }
				}
				default:
					return acquisition.kind satisfies never
			}
		})
	}

	// CAP-020-R16, ADR-053 bod 3, ADR-053 (doplnění 2026-09-24) bod 3
	private async read<T>(
		reader: ClinicalReader,
		operation: string,
		hidden: T,
		work: (options: MedplumRequestOptions) => Promise<T>,
	): Promise<T> {
		try {
			await signedIn(this.client, this.settings)
			return await work({ headers: { [ON_BEHALF_OF_HEADER]: `${MEMBERSHIP_REFERENCE}${reader.membershipResourceId}` } })
		} catch (error) {
			if (isForbidden(error)) {
				return hidden
			}
			throw storeErrorOf(error, operation)
		}
	}

	private async woundsOf(query: SearchQuery, options: MedplumRequestOptions): Promise<HistoryWounds> {
		const found = await this.observations(query, options)
		const bodyStructures = await this.bodyStructuresOf(found.observations, options)
		return closedWoundsOf({ ...found, bodyStructures }, this.context)
	}

	private async observations(query: SearchQuery, options: MedplumRequestOptions): Promise<ObservationResources> {
		const resources = await allPagesOf(this.client, "Observation", query, options)
		return {
			observations: ofType<Observation>(resources, "Observation"),
			conditions: ofType<Condition>(resources, "Condition"),
		}
	}

	private async documents(query: SearchQuery, options: MedplumRequestOptions): Promise<DocumentReference[]> {
		return ofType<DocumentReference>(
			await allPagesOf(this.client, "DocumentReference", query, options),
			"DocumentReference",
		)
	}

	// ADR-050 bod 4
	private async bodyStructuresOf(
		observations: readonly Observation[],
		options: MedplumRequestOptions,
	): Promise<BodyStructure[]> {
		const ids = [...new Set(observations.filter(isAssessment).map(bodyStructureIdOf).filter(present))]
		if (ids.length === 0) {
			return []
		}
		return ofType<BodyStructure>(
			await allPagesOf(this.client, "BodyStructure", bodyStructureQueryOf(ids), options),
			"BodyStructure",
		)
	}
}
