import {
	type ActorDepartment,
	CLINICAL_RECORD_FAILURE,
	type ClinicalActor,
	type ClinicalAuthor,
	type ClinicalClosure,
	type ClinicalCodeListSet,
	type ClinicalDelivery,
	type ClinicalDraftAssessment,
	type ClinicalDraftDocument,
	type ClinicalDraftFinding,
	type ClinicalDraftWoundType,
	type ClinicalEncounterRecord,
	type ClinicalFileResource,
	type ClinicalFoundedDocument,
	ClinicalRecordStoreError,
	type ClinicalRecordStorePort,
	type ClinicalScanClosure,
	type ClinicalScannedDocumentPdf,
	type ClinicalStation,
	type ClinicalWithdrawnDocument,
	type ClinicalWoundClosure,
	type ClinicalWoundTypeChange,
	type ClosureResourceIds,
	type DraftDocumentResourceIds,
	type EncounterResourceIds,
	type FindingResourceIds,
	type ScanClosureResourceIds,
} from "@ansora/vulna-domain/ports"
import { createReference, getReferenceString, MedplumClient } from "@medplum/core"
import {
	type ActorPolicies,
	departmentOrganizationOf,
	membershipAccessOf,
	membershipOf,
	practitionerOf,
	practitionerRoleOf,
	sameAccess,
	userOf,
} from "./actor-resources"
import { SHA1_BASE64, storedDigestOf } from "./binary-digest"
import { idOfEntry, requireWritten } from "./bundle-entries"
import { signedIn } from "./client-login"
import {
	type ClosureReferences,
	scanClosureBundleOf,
	scannedPdfDocumentOf,
	stationDeviceOf,
	woundClosureBundleOf,
} from "./closure-resources"
import { activeValueSetOf, codeListUrlsOf, codeSystemOf, wholeValueSetOf } from "./code-list-resources"
import { deliveryBundleOf } from "./delivery-resources"
import {
	draftDocumentBundleOf,
	draftDocumentOf,
	draftStudyOf,
	type PlacedStudy,
	withdrawnStudyOf,
} from "./document-resources"
import { type DraftChange, FINDING_RECORD } from "./draft-records"
import { encounterBundleOf, resourceIdsOf, serverDeviceOf } from "./encounter-resources"
import { storeErrorOf } from "./failure"
import type {
	AccessPolicy,
	Bundle,
	Device,
	ImagingStudy,
	Organization,
	Practitioner,
	PractitionerRole,
	Project,
	Reference,
	Resource,
} from "./fhir-types"
import { fileResourceOf, fileTokenOf, IMAGING_STUDY_REFERENCE } from "./file-resources"
import { findingBundleOf, findingResourceIdsOf, withdrawnFindingBundleOf } from "./finding-resources"
import {
	type IdentifierSystems,
	identifierSystemsOf,
	practitionerRoleValueOf,
	serverDeviceValueOf,
	tokenOf,
} from "./identifiers"
import { assessmentObservationOf, woundTypeObservationOf } from "./observation-resources"
import { NO_ACCESS_POLICY_NAME, ROLE_POLICY_NAME_PREFIX, SEARCH_LIMIT } from "./project"
import type { ProjectionContext } from "./resource-meta"
import { type Fetch, timedFetch } from "./timed-fetch"
import { woundTypeChangeBundleOf } from "./wound-type-change-resources"

export interface MedplumSettings {
	baseUrl: string
	clientId: string
	clientSecret: string
	canonicalBase: string
	instanceBaseUri: string
	serverVersion: string
	fetch?: Fetch
}

const EXTERNAL_ID = "external-id"

interface WrittenClosure {
	request: Bundle
	result: Bundle
	stationId: string
}

const OPERATION: Record<DraftChange, string> = {
	[FINDING_RECORD.DRAFT]: "recording",
	[FINDING_RECORD.WITHDRAWN]: "withdrawing",
}

// ADR-042 bod 1, ADR-054 bod 1, ADR-054 bod 3, CAP-012-R30
export class MedplumClinicalRecordStore implements ClinicalRecordStorePort {
	private readonly client: MedplumClient
	private readonly systems: IdentifierSystems
	private readonly context: ProjectionContext

	constructor(private readonly settings: MedplumSettings) {
		this.systems = identifierSystemsOf(settings.canonicalBase)
		this.context = { systems: this.systems, instanceBase: settings.instanceBaseUri }
		this.client = new MedplumClient({ baseUrl: settings.baseUrl, fetch: timedFetch(settings.fetch ?? fetch) })
	}

	// CAP-001-R31, CAP-021-R38, ADR-053 bod 6
	async recordActor(actor: ClinicalActor): Promise<string> {
		try {
			await this.signIn()
			const practitioner = createReference(
				await this.client.upsertResource(practitionerOf(actor, this.systems), {
					identifier: tokenOf(this.systems.practitioner, actor.userId),
				}),
			)
			if (actor.department !== undefined) {
				await this.recordPractitionerRole(actor, actor.department, practitioner)
			}
			return await this.reconcileMembership(actor, practitioner)
		} catch (error) {
			throw storeErrorOf(error, `recording the actor of user ${actor.userId}`)
		}
	}

	// CAP-014-R17, ADR-050 bod 10, ADR-054 bod 3
	async recordEncounter(record: ClinicalEncounterRecord): Promise<EncounterResourceIds> {
		try {
			await this.signIn()
			const root = await this.rootOrganization()
			const serviceProvider =
				record.encounter.department === undefined
					? createReference(root)
					: await this.departmentOrganization(record.encounter.department, createReference(root))
			const bundle = encounterBundleOf(record, {
				systems: this.systems,
				instanceBase: this.settings.instanceBaseUri,
				serviceProvider,
				device: await this.serverDevice(root),
			})
			return resourceIdsOf(await this.client.executeBatch(bundle))
		} catch (error) {
			throw storeErrorOf(error, `recording the encounter ${record.encounter.encounterId}`)
		}
	}

	// CAP-016-R17, CAP-020-R13, ADR-050 (doplnění D33), ADR-054 bod 3
	async recordDraftFinding(finding: ClinicalDraftFinding): Promise<FindingResourceIds> {
		try {
			await this.signIn()
			const bundle = findingBundleOf(finding, FINDING_RECORD.DRAFT, this.context)
			return findingResourceIdsOf(await this.client.executeBatch(bundle))
		} catch (error) {
			throw storeErrorOf(error, `recording the finding ${finding.findingId}`)
		}
	}

	// ADR-050 (doplnění D33) bod 3, ADR-050 bod 10, ADR-052 bod 6
	async withdrawDraftFinding(
		finding: ClinicalDraftFinding,
		woundType: ClinicalDraftWoundType | undefined,
	): Promise<void> {
		try {
			await this.signIn()
			const bundle = withdrawnFindingBundleOf(finding, woundType, this.context)
			requireWritten(bundle, await this.client.executeBatch(bundle))
		} catch (error) {
			throw storeErrorOf(error, `withdrawing the finding ${finding.findingId}`)
		}
	}

	// CAP-017-R02, CAP-020-R19, ADR-052 bod 3, ADR-054 bod 3
	async recordDraftWoundType(woundType: ClinicalDraftWoundType): Promise<string> {
		try {
			await this.signIn()
			const observation = await this.client.upsertResource(
				woundTypeObservationOf(woundType, FINDING_RECORD.DRAFT, this.context),
				{ identifier: tokenOf(this.systems.findingWoundType, woundType.findingId) },
			)
			return writtenIdOf(observation.id, "wound type observation")
		} catch (error) {
			throw storeErrorOf(error, `recording the wound type of the finding ${woundType.findingId}`)
		}
	}

	// CAP-017-R03, CAP-017-R04, ADR-052 bod 3, ADR-054 bod 3
	async recordDraftAssessment(assessment: ClinicalDraftAssessment): Promise<string> {
		return await this.writeAssessment(assessment, FINDING_RECORD.DRAFT)
	}

	// ADR-050 (doplnění D33) bod 3, ADR-052 bod 6
	async withdrawDraftAssessment(assessment: ClinicalDraftAssessment): Promise<void> {
		await this.writeAssessment(assessment, FINDING_RECORD.WITHDRAWN)
	}

	// CAP-021-R39, CAP-021-R28, ADR-052 bod 3, ADR-054 bod 3
	async recordDraftDocument(document: ClinicalFoundedDocument): Promise<DraftDocumentResourceIds> {
		try {
			await this.signIn()
			const { encounterId } = document.study
			const resource = draftStudyOf(await this.studyOf(encounterId), document, this.context)
			const result = await this.writeDraftDocument(document, FINDING_RECORD.DRAFT, { encounterId, resource })
			return {
				document: idOfEntry(result.entry?.[0], "scanned document"),
				imagingStudy: idOfEntry(result.entry?.[1], "imaging study"),
			}
		} catch (error) {
			throw storeErrorOf(error, `recording the document ${document.documentId}`)
		}
	}

	// CAP-021-R39, ADR-050 (doplnění D33) bod 3, ADR-052 bod 6
	async withdrawDraftDocument(document: ClinicalWithdrawnDocument): Promise<void> {
		try {
			await this.signIn()
			await this.writeDraftDocument(document, FINDING_RECORD.WITHDRAWN, await this.withdrawnStudyOf(document))
		} catch (error) {
			throw storeErrorOf(error, `withdrawing the document ${document.documentId}`)
		}
	}

	// CAP-021-R27, CAP-021-R31, ADR-050, ADR-054
	async recordWoundClosure(closure: ClinicalWoundClosure): Promise<ClosureResourceIds> {
		const written = await this.writeClosure(closure, (references) =>
			woundClosureBundleOf(closure, references, this.context),
		)
		return { imagingStudy: idOfResource(written, "ImagingStudy"), station: written.stationId }
	}

	// CAP-021-R27, CAP-021-R39, ADR-050, ADR-054
	async recordScanClosure(closure: ClinicalScanClosure): Promise<ScanClosureResourceIds> {
		const written = await this.writeClosure(closure, (references) =>
			scanClosureBundleOf(closure, references, this.context),
		)
		return {
			imagingStudy: idOfResource(written, "ImagingStudy"),
			station: written.stationId,
			document: idOfResource(written, "DocumentReference"),
		}
	}

	// CAP-020-R21, ADR-049 (doplnění D32), ADR-050 bod 10, ADR-054 bod 3
	async recordWoundTypeChange(change: ClinicalWoundTypeChange): Promise<string> {
		try {
			await this.signIn()
			const request = woundTypeChangeBundleOf(change, await this.authorReference(change.author), this.context)
			const result = await this.client.executeBatch(request)
			requireWritten(request, result)
			return idOfEntry(result.entry?.[0], "wound type observation")
		} catch (error) {
			throw storeErrorOf(error, `changing the wound type of the finding ${change.findingId}`)
		}
	}

	// CAP-017-R20, CAP-017-S15, ADR-050 bod 7, backend.md 3 T6
	async publishCodeLists(set: ClinicalCodeListSet): Promise<void> {
		try {
			await this.signIn()
			for (const list of set.codeLists) {
				const urls = codeListUrlsOf(this.settings.instanceBaseUri, list.code)
				await this.client.upsertResource(codeSystemOf(list, set, urls, this.context), { url: urls.codeSystem })
				await this.client.upsertResource(wholeValueSetOf(list, set, urls, this.context), { url: urls.valueSet })
				await this.client.upsertResource(activeValueSetOf(list, set, urls, this.context), { url: urls.activeValueSet })
			}
		} catch (error) {
			throw storeErrorOf(error, `publishing the code list set ${set.version}`)
		}
	}

	// CAP-021-R37, ADR-050 bod 13
	async recordFileResource(file: ClinicalFileResource): Promise<string> {
		try {
			await this.signIn()
			const resource = await this.client.upsertResource(fileResourceOf(file, this.context), {
				identifier: fileTokenOf(file, this.context),
			})
			return resource.id
		} catch (error) {
			throw storeErrorOf(error, `recording the resource of ${file.kind} ${file.fileId}`)
		}
	}

	// CAP-021-R39, CAP-021-R36, backend.md 3.1 T7
	async recordScannedDocumentPdf(document: ClinicalScannedDocumentPdf): Promise<string> {
		try {
			await this.signIn()
			const resource = scannedPdfDocumentOf(
				document,
				`${IMAGING_STUDY_REFERENCE}${document.studyResourceId}`,
				await this.authorReference(document.author),
				this.context,
			)
			const written = await this.client.upsertResource(resource, {
				identifier: tokenOf(this.systems.document, document.documentId),
			})
			return written.id
		} catch (error) {
			throw storeErrorOf(error, `recording the PDF of the document ${document.documentId}`)
		}
	}

	// CAP-021-R28, backend.md 3 T4, datovy-model.md 13.1
	async recordDelivery(delivery: ClinicalDelivery): Promise<string> {
		try {
			await this.signIn()
			const existing = await this.studyOf(delivery.study.encounterId)
			if (existing === undefined) {
				throw new ClinicalRecordStoreError(
					CLINICAL_RECORD_FAILURE.REJECTED,
					`the study of the encounter ${delivery.study.encounterId} is not in the store`,
				)
			}
			const server = await this.serverDevice(await this.rootOrganization())
			const request = deliveryBundleOf(existing, delivery, server, this.context)
			const result = await this.client.executeBatch(request)
			requireWritten(request, result)
			return idOfEntry(result.entry?.[0], "imaging study")
		} catch (error) {
			throw storeErrorOf(error, `recording the delivery of the record ${delivery.acquisitionId}`)
		}
	}

	// CAP-021-R37, CAP-026-R18, ADR-050 bod 11
	async attachmentHashOf(binaryId: string): Promise<string> {
		const operation = `reading binary ${binaryId}`
		try {
			await this.signIn()
			const hash = await storedDigestOf(this.client, binaryId, SHA1_BASE64, operation)
			if (hash === undefined) {
				throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, `${operation}: the binary is gone`)
			}
			return hash
		} catch (error) {
			throw storeErrorOf(error, operation)
		}
	}

	// ADR-050, ADR-054
	private async writeClosure(
		closure: ClinicalClosure,
		bundleOf: (references: ClosureReferences) => Bundle,
	): Promise<WrittenClosure> {
		try {
			await this.signIn()
			const station = await this.stationDevice(closure.station)
			const references: ClosureReferences = {
				author: await this.authorReference(closure.author),
				station: literalReferenceOf(station),
				department: closure.department === undefined ? undefined : await this.departmentPerformer(closure.department),
				existingStudy: await this.studyOf(closure.study.encounterId),
			}
			const request = bundleOf(references)
			const result = await this.client.executeBatch(request)
			requireWritten(request, result)
			return { request, result, stationId: writtenIdOf(station.id, "device") }
		} catch (error) {
			throw storeErrorOf(error, `closing the record ${closure.acquisitionId}`)
		}
	}

	// integrace-dicom.md 5.9, datovy-model.md 13.1
	private async departmentPerformer(department: ActorDepartment): Promise<Reference<Organization>> {
		const organization = await this.departmentOrganization(department, createReference(await this.rootOrganization()))
		return { reference: organization.reference }
	}

	// ADR-050, datovy-model.md 13.1
	private async stationDevice(station: ClinicalStation): Promise<Device> {
		return await this.client.createResourceIfNoneExist(
			stationDeviceOf(station, this.systems),
			`identifier=${tokenOf(this.systems.device, station.deviceId)}`,
		)
	}

	// ADR-050, CAP-021-R38
	private async authorReference(author: ClinicalAuthor): Promise<Reference<Practitioner | PractitionerRole>> {
		const resource =
			author.department === undefined
				? await this.client.searchOne("Practitioner", {
						identifier: tokenOf(this.systems.practitioner, author.userId),
					})
				: await this.client.searchOne("PractitionerRole", {
						identifier: tokenOf(
							this.systems.practitionerRole,
							practitionerRoleValueOf(author.userId, author.department.id),
						),
					})
		if (resource === undefined) {
			throw new ClinicalRecordStoreError(
				CLINICAL_RECORD_FAILURE.UNAVAILABLE,
				`the actor of user ${author.userId} is not in the store yet`,
			)
		}
		return literalReferenceOf(resource)
	}

	private async writeAssessment(assessment: ClinicalDraftAssessment, record: DraftChange): Promise<string> {
		try {
			await this.signIn()
			const observation = await this.client.upsertResource(assessmentObservationOf(assessment, record, this.context), {
				identifier: tokenOf(this.systems.acquisition, assessment.acquisitionId),
			})
			return writtenIdOf(observation.id, "healing phase observation")
		} catch (error) {
			throw storeErrorOf(error, `${OPERATION[record]} the assessment of the record ${assessment.acquisitionId}`)
		}
	}

	// CAP-021-R39, ADR-050 bod 10
	private async writeDraftDocument(
		document: ClinicalDraftDocument,
		record: DraftChange,
		study: PlacedStudy | undefined,
	): Promise<Bundle> {
		const request = draftDocumentBundleOf(
			document,
			draftDocumentOf(document, record, this.context),
			study,
			this.context,
		)
		const result = await this.client.executeBatch(request)
		requireWritten(request, result)
		return result
	}

	// ADR-050 (doplnění D33) bod 3, CAP-015-R17, CAP-014-R25
	private async withdrawnStudyOf(document: ClinicalWithdrawnDocument): Promise<PlacedStudy | undefined> {
		if (document.series === undefined) {
			return undefined
		}
		const { encounterId } = document.series
		const existing = await this.studyOf(encounterId)
		return existing === undefined
			? undefined
			: { encounterId, resource: withdrawnStudyOf(existing, document.series, document, this.context) }
	}

	// ADR-050, datovy-model.md 13.1
	private async studyOf(encounterId: string): Promise<ImagingStudy | undefined> {
		return await this.client.searchOne("ImagingStudy", { identifier: tokenOf(this.systems.imagingStudy, encounterId) })
	}

	// ADR-050 bod 10, CAP-001-S34
	private async signIn(): Promise<void> {
		await signedIn(this.client, this.settings)
	}

	// ADR-050 bod 5
	private async recordPractitionerRole(
		actor: ClinicalActor,
		department: ActorDepartment,
		practitioner: Reference<Practitioner>,
	): Promise<void> {
		const organization = await this.departmentOrganization(department, createReference(await this.rootOrganization()))
		await this.client.upsertResource(practitionerRoleOf(actor, department, practitioner, organization, this.systems), {
			identifier: tokenOf(this.systems.practitionerRole, practitionerRoleValueOf(actor.userId, department.id)),
		})
	}

	// ADR-050 bod 10
	private async departmentOrganization(
		department: ActorDepartment,
		root: Reference<Organization>,
	): Promise<Reference<Organization>> {
		const organization = await this.client.createResourceIfNoneExist(
			departmentOrganizationOf(department, root, this.systems),
			`identifier=${tokenOf(this.systems.department, department.id)}`,
		)
		return createReference(organization)
	}

	private async rootOrganization(): Promise<Organization> {
		const roots = await this.client.searchResources("Organization", {
			identifier: `${this.systems.organization}|`,
		})
		const [root] = roots
		if (root === undefined || roots.length > 1) {
			throw new ClinicalRecordStoreError(
				CLINICAL_RECORD_FAILURE.REJECTED,
				`the store holds ${roots.length} root organizations instead of one; run the installation`,
			)
		}
		return root
	}

	// ADR-050 bod 10, datovy-model.md 13.3
	private async serverDevice(root: Organization): Promise<Reference<Device>> {
		const instanceCode = instanceCodeOf(root, this.systems)
		const device = await this.client.createResourceIfNoneExist(
			serverDeviceOf(instanceCode, this.settings.serverVersion, this.systems),
			`identifier=${tokenOf(this.systems.device, serverDeviceValueOf(instanceCode, this.settings.serverVersion))}`,
		)
		return createReference(device)
	}

	// ADR-053 bod 6, datovy-model.md 13.2
	private async reconcileMembership(actor: ClinicalActor, practitioner: Reference<Practitioner>): Promise<string> {
		const project = this.project()
		const user =
			(await this.client.searchOne("User", { [EXTERNAL_ID]: actor.userId })) ??
			(await this.client.createResource(userOf(actor, project)))
		const access = membershipAccessOf(actor, await this.actorPolicies(), this.systems)
		const membership = await this.client.searchOne("ProjectMembership", { [EXTERNAL_ID]: actor.userId })
		if (membership === undefined) {
			return (
				await this.client.createResource(membershipOf(actor, project, createReference(user), practitioner, access))
			).id
		}
		if (membership.profile.reference !== practitioner.reference || !sameAccess(membership.access, access)) {
			await this.client.updateResource({ ...membership, profile: practitioner, access })
		}
		return membership.id
	}

	private project(): Reference<Project> {
		const project = this.client.getProject()
		if (project === undefined) {
			throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "the store returned no project")
		}
		return createReference(project)
	}

	private async actorPolicies(): Promise<ActorPolicies> {
		const policies = await this.client.searchResources("AccessPolicy", { _count: SEARCH_LIMIT })
		const noAccess = policies.find((policy) => policy.name === NO_ACCESS_POLICY_NAME)
		if (noAccess === undefined) {
			throw new ClinicalRecordStoreError(
				CLINICAL_RECORD_FAILURE.REJECTED,
				"the store has no policy without access; run the installation",
			)
		}
		return { noAccess: createReference(noAccess), byRole: rolePoliciesOf(policies) }
	}
}

// datovy-model.md 13.3
function instanceCodeOf(root: Organization, systems: IdentifierSystems): string {
	const code = root.identifier?.find((identifier) => identifier.system === systems.organization)?.value
	if (code === undefined) {
		throw new ClinicalRecordStoreError(
			CLINICAL_RECORD_FAILURE.REJECTED,
			"the root organization carries no instance code; run the installation",
		)
	}
	return code
}

function rolePoliciesOf(policies: readonly AccessPolicy[]): Map<string, Reference<AccessPolicy>> {
	const byRole = new Map<string, Reference<AccessPolicy>>()
	for (const policy of policies) {
		if (policy.name?.startsWith(ROLE_POLICY_NAME_PREFIX) === true) {
			byRole.set(policy.name.slice(ROLE_POLICY_NAME_PREFIX.length), createReference(policy))
		}
	}
	return byRole
}

// datovy-model.md 13.1
function literalReferenceOf<T extends Resource>(resource: T): Reference<T> {
	return { reference: getReferenceString(resource) }
}

// ADR-050
function idOfResource(written: WrittenClosure, resourceType: string): string {
	const index = (written.request.entry ?? []).findIndex((entry) => entry.resource?.resourceType === resourceType)
	return idOfEntry(written.result.entry?.[index], resourceType)
}

function writtenIdOf(id: string | undefined, what: string): string {
	if (id === undefined) {
		throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, `the store did not return the ${what}`)
	}
	return id
}
