// ADR-050 bod 2
export const DEFAULT_CANONICAL_BASE = "https://fhir.ansora.cz/vulna"

export interface IdentifierSystems {
	patient: string
	encounter: string
	finding: string
	findingSite: string
	findingWoundType: string
	acquisition: string
	imagingStudy: string
	document: string
	image: string
	documentPage: string
	practitioner: string
	practitionerRole: string
	department: string
	organization: string
	device: string
	departmentTag: string
	patientTag: string
	provenanceKeyTag: string
	draftTag: string
	projectionTag: string
	findingKind: string
	conditionCategory: string
	bodySurface: string
	bodyDiagramPosition: string
	woundFindingProfile: string
	woundSiteProfile: string
	woundTypeProfile: string
	healingPhaseProfile: string
	imagingStudyProfile: string
	scannedDocumentProfile: string
	woundPhotoProfile: string
	documentPageProfile: string
	imageKind: string
	fileSequence: string
	attachmentSha256: string
	contentAvailability: string
	attachmentKind: string
	// integrace-dicom.md 5.9 Derivation Description
	instanceDescription: string
}

// ADR-050 bod 2, datovy-model.md 13.3
export function identifierSystemsOf(canonicalBase: string): IdentifierSystems {
	const base = withoutTrailingSlash(canonicalBase)
	return {
		patient: `${base}/sid/patient`,
		encounter: `${base}/sid/encounter`,
		finding: `${base}/sid/finding`,
		findingSite: `${base}/sid/finding-site`,
		findingWoundType: `${base}/sid/finding-wound-type`,
		acquisition: `${base}/sid/acquisition`,
		imagingStudy: `${base}/sid/imaging-study`,
		document: `${base}/sid/document`,
		image: `${base}/sid/image`,
		documentPage: `${base}/sid/document-page`,
		practitioner: `${base}/sid/practitioner`,
		practitionerRole: `${base}/sid/practitioner-role`,
		department: `${base}/sid/department`,
		organization: `${base}/sid/organization`,
		device: `${base}/sid/device`,
		departmentTag: `${base}/tag/department`,
		patientTag: `${base}/tag/patient`,
		provenanceKeyTag: `${base}/tag/provenance-key`,
		draftTag: `${base}/tag/draft`,
		projectionTag: `${base}/CodeSystem/vulna-projection`,
		findingKind: `${base}/CodeSystem/vulna-finding-kind`,
		conditionCategory: `${base}/CodeSystem/vulna-condition-category`,
		bodySurface: `${base}/CodeSystem/vulna-body-surface`,
		bodyDiagramPosition: `${base}/StructureDefinition/body-diagram-position`,
		// datovy-model.md 13.1
		woundFindingProfile: `${base}/StructureDefinition/vulna-wound-finding`,
		woundSiteProfile: `${base}/StructureDefinition/vulna-wound-site`,
		woundTypeProfile: `${base}/StructureDefinition/vulna-wound-type`,
		healingPhaseProfile: `${base}/StructureDefinition/vulna-healing-phase`,
		imagingStudyProfile: `${base}/StructureDefinition/vulna-imaging-study`,
		scannedDocumentProfile: `${base}/StructureDefinition/vulna-scanned-document`,
		// ADR-050 bod 13
		woundPhotoProfile: `${base}/StructureDefinition/vulna-wound-photo`,
		documentPageProfile: `${base}/StructureDefinition/vulna-document-page`,
		imageKind: `${base}/CodeSystem/vulna-image-kind`,
		fileSequence: `${base}/StructureDefinition/file-sequence`,
		attachmentSha256: `${base}/StructureDefinition/attachment-sha256`,
		contentAvailability: `${base}/StructureDefinition/content-availability`,
		attachmentKind: `${base}/StructureDefinition/attachment-kind`,
		instanceDescription: `${base}/StructureDefinition/instance-description`,
	}
}

// ADR-050 bod 7, CAP-012-R30
export function codeSystemUrlOf(instanceBase: string, codeListCode: string): string {
	return `${withoutTrailingSlash(instanceBase)}/CodeSystem/${codeListCode}`
}

export function valueSetUrlOf(instanceBase: string, codeListCode: string): string {
	return `${withoutTrailingSlash(instanceBase)}/ValueSet/${codeListCode}`
}

// ADR-050 bod 4, datovy-model.md 13.3
export function practitionerRoleValueOf(userId: string, departmentId: string): string {
	return `${userId}.${departmentId}`
}

// datovy-model.md 13.3
export function serverDeviceValueOf(instanceCode: string, serverVersion: string): string {
	return `${instanceCode}:server:${serverVersion}`
}

const CUSTOMER_PATIENT_ID = "patient-id"
const UNNAMED_ISSUER = "registry"
const UNSAFE_SEGMENT = /[^a-z0-9.-]+/g
const EDGE_DASHES = /^-+|-+$/g
const TRAILING_SLASHES = /\/+$/

// ADR-050 bod 2, CAP-024-R07
export function customerIdentifierSystemOf(instanceBase: string, issuer: string | undefined): string {
	return `${withoutTrailingSlash(instanceBase)}/sid/customer/${segmentOf(issuer ?? UNNAMED_ISSUER)}/${CUSTOMER_PATIENT_ID}`
}

function segmentOf(issuer: string): string {
	const segment = issuer.toLowerCase().replace(UNSAFE_SEGMENT, "-").replace(EDGE_DASHES, "")
	return segment === "" ? UNNAMED_ISSUER : segment
}

// ADR-050 bod 2
export function instanceSourceOf(instanceBase: string): string {
	return withoutTrailingSlash(instanceBase)
}

export function withoutTrailingSlash(base: string): string {
	return base.replace(TRAILING_SLASHES, "")
}

export function tokenOf(system: string, value: string): string {
	return `${system}|${value}`
}
