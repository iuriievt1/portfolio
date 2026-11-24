// B15, ADR-033 bod 2, 6, architektura.md 2.3, TS-113

export const LAYER = {
	CONTRACTS: "layer:contracts",
	CORE: "layer:core",
	DOMAIN: "layer:domain",
	ADAPTER: "layer:adapter",
	APPLICATION: "layer:app",
} as const

const PROCESS = {
	API: "process:api",
	WORKER: "process:worker",
	MOBILE: "process:mobile",
	ADMIN: "process:admin",
	SHARED: "process:shared",
} as const

export interface TagRule {
	subject: string
	onlyDependOnTags?: readonly string[]
	notDependOnTags?: readonly string[]
	transitive?: boolean
	reason: string
	source: string
}

// architektura.md 2.3
export const TAG_RULES: readonly TagRule[] = [
	{
		subject: LAYER.DOMAIN,
		onlyDependOnTags: [LAYER.CONTRACTS, LAYER.CORE, LAYER.DOMAIN],
		reason: "the domain does not know the adapter",
		source: "ADR-003 ř. 26",
	},
	{
		subject: LAYER.ADAPTER,
		notDependOnTags: [LAYER.ADAPTER],
		reason: "an adapter must not import another adapter",
		source: "ADR-003 ř. 26",
	},
	{
		subject: LAYER.CORE,
		notDependOnTags: [LAYER.DOMAIN, LAYER.ADAPTER],
		reason: "the core never calls a module; a module calls the core through a port",
		source: "docs/spec/mdr-pripravenost.md, opatření M4",
	},
	{
		subject: PROCESS.MOBILE,
		notDependOnTags: [PROCESS.API, PROCESS.WORKER],
		transitive: true,
		reason: "the mobile app does not know the server projects",
		source: "návrh veevoy (?), docs/spec/architektura.md kap. 2.3",
	},
]

// ADR-005 ř. 37–39, architektura.md 2.3
export const API_MUST_NOT_REACH: TagRule = {
	subject: PROCESS.API,
	notDependOnTags: [PROCESS.WORKER],
	transitive: true,
	reason: "the API process must not reach worker code; it loads neither the DICOM library nor OCR",
	source: "ADR-005 ř. 38–39",
}

// ADR-005 ř. 38–39
export const WORKER_PROCESS_TAG = PROCESS.WORKER

// ADR-042 bod 6, ADR-054 bod 1, 3
export const CLINICAL_RECORD_ADAPTER = "@ansora/vulna-adapter-clinical-record-medplum"
export const MEDPLUM_IMPORT = "@medplum/"
export const MEDPLUM_PACKAGES = `${MEDPLUM_IMPORT}*`
export const CLINICAL_RECORD_PORT = "ClinicalRecordStore"

// architektura.md 2.3
export const CLINICAL_RECORD_FORBIDDEN_PROCESSES = [PROCESS.MOBILE, PROCESS.ADMIN] as const

// ADR-035 bod 1, architektura.md 2.3
export const DICOM_PROJECTION = "@ansora/vulna-projection-dicom"
export const DICOM_PROJECTION_DEPENDENTS: readonly string[] = ["@ansora/server-worker"]

// ADR-005 ř. 38–39, ADR-017, ADR-018, CAP-021-R40
export const WORKER_ONLY_EXTERNAL_IMPORTS = [
	"dcmjs",
	"@veevoy/dcmjs",
	"@veevoy/dcmjs-dimse",
	"dicom-parser",
	"@cornerstonejs/dicom-image-loader",
	"tesseract.js",
	"jpeg-js",
] as const

// ADR-003 ř. 26
export const PORT_OWNERS = ["@ansora/vulna-domain", "@ansora/core-server"] as const
