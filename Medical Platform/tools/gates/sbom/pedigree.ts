import type { Finding } from "../image/finding"
import { type Component, MANUFACTURER, npmPurl, type Pedigree } from "./cyclonedx"

const GATE = "B5"
// vendor/*/PEDIGREE.md
const ROW = { UPSTREAM: "Upstream", COMMIT: "Commit", NPM_PACKAGE: "Balíček npm" } as const
const ROW_END = /\|\s*$/
const GITHUB_REPOSITORY = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+$/
const COMMIT_HASH = /`([0-9a-f]{40})`/
const PACKAGE_SPEC = /`((?:@[^`@/]+\/)?[^`@]+)@([^`]+)`/

export interface ForkOrigin {
	repository: string
	commit: string
	name: string
	version: string
}

export interface VendoredFork {
	name: string
	pedigree: string
	markdown: string | undefined
}

export interface ForkPedigrees {
	components: Component[]
	findings: Finding[]
}

type ForkCheck = { finding: Finding } | { origin: ForkOrigin }

function rowValue(markdown: string, label: string): string {
	const prefix = `| ${label} |`
	const row = markdown.split("\n").find((line) => line.startsWith(prefix)) ?? ""
	return row.slice(prefix.length).replace(ROW_END, "").trim()
}

export function forkOriginOf(markdown: string): ForkOrigin | undefined {
	const repository = rowValue(markdown, ROW.UPSTREAM)
	const commit = COMMIT_HASH.exec(rowValue(markdown, ROW.COMMIT))?.[1]
	const [, name, version] = PACKAGE_SPEC.exec(rowValue(markdown, ROW.NPM_PACKAGE)) ?? []
	if (!GITHUB_REPOSITORY.test(repository) || commit === undefined || name === undefined || version === undefined) {
		return undefined
	}
	return { repository, commit, name, version }
}

function forkPedigreeOf(origin: ForkOrigin, pedigreeFile: string): Pedigree {
	return {
		ancestors: [
			{ type: "library", name: origin.name, version: origin.version, purl: npmPurl(origin.name, origin.version) },
		],
		commits: [{ uid: origin.commit, url: `${origin.repository}/commit/${origin.commit}` }],
		notes: `Modifications of the fork are listed in ${pedigreeFile}`,
	}
}

function derivesFrom(version: string, origin: ForkOrigin): boolean {
	return version.startsWith(`${origin.version}-${MANUFACTURER}.`)
}

function finding(what: string, reason: string): ForkCheck {
	return { finding: { gate: GATE, what, reason } }
}

function checkFork(fork: VendoredFork, versions: readonly string[]): ForkCheck {
	if (fork.markdown === undefined) {
		return finding(fork.pedigree, "pedigree file missing")
	}
	const origin = forkOriginOf(fork.markdown)
	if (origin === undefined) {
		return finding(fork.pedigree, "pedigree lacks the upstream GitHub repository, commit or npm package")
	}
	if (versions.length === 0) {
		return finding(fork.name, "vendored fork missing from the image SBOM")
	}
	const foreign = versions.find((version) => !derivesFrom(version, origin))
	if (foreign !== undefined) {
		return finding(
			`${fork.name}@${foreign}`,
			`fork version does not derive from ${origin.name}@${origin.version} of its pedigree`,
		)
	}
	return { origin }
}

function forkComponent({ cpe: _guessedFromName, ...component }: Component, pedigree: Pedigree): Component {
	return { ...component, supplier: { name: MANUFACTURER }, pedigree }
}

// ADR-017, Q-035
export function withForkPedigrees(components: readonly Component[], forks: readonly VendoredFork[]): ForkPedigrees {
	const findings: Finding[] = []
	const pedigrees = new Map<string, Pedigree>()
	for (const fork of forks) {
		const versions = components
			.filter((component) => component.name === fork.name)
			.map((component) => component.version)
		const check = checkFork(fork, versions)
		if ("finding" in check) {
			findings.push(check.finding)
			continue
		}
		pedigrees.set(fork.name, forkPedigreeOf(check.origin, fork.pedigree))
	}
	return {
		components: components.map((component) => {
			const pedigree = pedigrees.get(component.name)
			return pedigree === undefined ? component : forkComponent(component, pedigree)
		}),
		findings,
	}
}
