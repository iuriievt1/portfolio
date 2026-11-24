export interface PinnedImage {
	image: string
	digest: string
}

export interface SourceImage extends PinnedImage {
	version: string
	license: string
}

// vydani-sbom-a-brany.md 2.2, Q-135
export interface ThirdPartyImage extends SourceImage {
	name: string
}

// CAP-029-R30, CAP-029-S20
export interface BuiltImage {
	name: string
	dockerfile: string
	image: string
	baseImage: PinnedImage
	sourceImage: SourceImage
}

// ADR-017, ADR-003 ř. 26
export interface VendoredPackage {
	name: string
	pedigree: string
	source: string
}

export interface Profile {
	id: string
	nameTowardsCustomer: string
	corePackages: string[]
	domainPackages: string[]
	adapters: string[]
	applications: string[]
	vendoredPackages?: VendoredPackage[]
	bannedPackages: { pattern: string }[]
	communicationTargets: { target: string }[]
	mobileRelease: { serverUrl: string | null; oidcDiscoveryUrl: string | null; pinningFingerprints: string[] | null }
	baseImage: { image: string; digest: string | null }
	thirdPartyImages?: ThirdPartyImage[]
	builtImages?: BuiltImage[]
}

const IMAGE_TAG = /:(\w[\w.-]*)(?:@[^@]+)?$/
const DEFAULT_TAG = "latest"

export function imageReference(pinned: PinnedImage): string {
	return `${pinned.image}@${pinned.digest}`
}

// CAP-029-R30
export function builtImageReference(built: BuiltImage, serverImage: string): string {
	return `${built.image}:${IMAGE_TAG.exec(serverImage)?.[1] ?? DEFAULT_TAG}`
}

export interface ConfigurationItem {
	type: string | string[]
	required?: boolean
	outboundTarget?: boolean
	default?: unknown
	enum?: unknown[]
	minimum?: number
	maximum?: number
	pattern?: string
	description?: string
}

export interface OutboundCommunication {
	target: string
}

// ADR-003 ř. 26
export interface ThirdPartyComponent {
	name: string
	version?: string
	supplier?: string
	pedigree?: string
}

export interface AdapterManifest {
	name: string
	ports: string[]
	processes: string[]
	outboundCommunication: OutboundCommunication[]
	configurationSchema?: Record<string, ConfigurationItem>
	thirdPartyComponents?: ThirdPartyComponent[]
}

export interface WorkspacePackage {
	name: string
	directory: string
	version?: string
	tags: string[]
	dependencies: string[]
}

export function vendoredPackageNames(profile: Profile): string[] {
	return (profile.vendoredPackages ?? []).map((vendored) => vendored.name)
}

export function profilePackages(profile: Profile): string[] {
	return [...profile.corePackages, ...profile.domainPackages, ...profile.adapters, ...profile.applications]
}
