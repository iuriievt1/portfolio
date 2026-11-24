import {
	CLINICAL_RECORD_ADAPTER,
	CLINICAL_RECORD_FORBIDDEN_PROCESSES,
	DICOM_PROJECTION,
	DICOM_PROJECTION_DEPENDENTS,
	LAYER,
	MEDPLUM_IMPORT,
	PORT_OWNERS,
	type TagRule,
	WORKER_ONLY_EXTERNAL_IMPORTS,
	WORKER_PROCESS_TAG,
} from "./rules"

export interface Project {
	name: string
	directory: string
	tags: readonly string[]
	dependencies: readonly string[]
}

export interface Finding {
	where: string
	what: string
	reason: string
	source: string
}

export type Projects = ReadonlyMap<string, Project>

function reachable(projects: Projects, from: string): Set<string> {
	const seen = new Set<string>()
	const queue = [...(projects.get(from)?.dependencies ?? [])]
	while (queue.length > 0) {
		const next = queue.shift()
		if (next === undefined || seen.has(next)) {
			continue
		}
		seen.add(next)
		queue.push(...(projects.get(next)?.dependencies ?? []))
	}
	return seen
}

function violatedTag(rule: TagRule, dependency: Project): string | undefined {
	const banned = rule.notDependOnTags?.find((tag) => dependency.tags.includes(tag))
	if (banned !== undefined) {
		return banned
	}
	const layer = dependency.tags.find((tag) => tag.startsWith("layer:"))
	if (rule.onlyDependOnTags !== undefined && layer !== undefined && !rule.onlyDependOnTags.includes(layer)) {
		return layer
	}
	return undefined
}

export function checkTagRule(projects: Projects, rule: TagRule): Finding[] {
	const findings: Finding[] = []
	for (const project of projects.values()) {
		if (!project.tags.includes(rule.subject)) {
			continue
		}
		const names = rule.transitive === true ? reachable(projects, project.name) : project.dependencies
		for (const name of names) {
			const dependency = projects.get(name)
			const tag = dependency === undefined ? undefined : violatedTag(rule, dependency)
			if (dependency !== undefined && tag !== undefined) {
				findings.push({
					where: project.directory,
					what: `${project.name} → ${dependency.name} (${tag})`,
					reason: rule.reason,
					source: rule.source,
				})
			}
		}
	}
	return findings
}

// architektura.md 2.3
export function checkClinicalRecordReach(projects: Projects): Finding[] {
	const findings: Finding[] = []
	for (const project of projects.values()) {
		const forbidden = CLINICAL_RECORD_FORBIDDEN_PROCESSES.some((tag) => project.tags.includes(tag))
		if (forbidden && reachable(projects, project.name).has(CLINICAL_RECORD_ADAPTER)) {
			findings.push({
				where: project.directory,
				what: `${project.name} → ${CLINICAL_RECORD_ADAPTER}`,
				reason: "only the API process and the worker load the clinical record adapter",
				source: "ADR-054 bod 3, docs/spec/architektura.md kap. 2.3",
			})
		}
	}
	return findings
}

const DICOM_PROJECTION_REASON = "only the entry point of the worker depends on the DICOM projection"
const DICOM_PROJECTION_SOURCE = "ADR-035 bod 1, docs/spec/architektura.md kap. 2.3"

// ADR-035 bod 1, architektura.md 2.3
export function checkDicomProjectionDependents(projects: Projects): Finding[] {
	const missing = [DICOM_PROJECTION, ...DICOM_PROJECTION_DEPENDENTS]
		.filter((name) => !projects.has(name))
		.map((name) => ({
			where: name,
			what: `${name} is not in the project graph`,
			reason: "the rule names a project the graph does not have, so it would check nothing",
			source: DICOM_PROJECTION_SOURCE,
		}))
	const dependents = [...projects.values()]
		.filter((project) => project.dependencies.includes(DICOM_PROJECTION))
		.filter((project) => !DICOM_PROJECTION_DEPENDENTS.includes(project.name))
		.map((project) => ({
			where: project.directory,
			what: `${project.name} → ${DICOM_PROJECTION}`,
			reason: DICOM_PROJECTION_REASON,
			source: DICOM_PROJECTION_SOURCE,
		}))
	return [...missing, ...dependents]
}

function importedProject(specifier: string, projects: Projects): Project | undefined {
	for (const project of projects.values()) {
		if (specifier === project.name || specifier.startsWith(`${project.name}/`)) {
			return project
		}
	}
	return undefined
}

export function checkImport(
	project: Project,
	where: string,
	specifier: string,
	projects: Projects,
	tagRules: readonly TagRule[],
): Finding[] {
	const findings: Finding[] = []
	const what = `import "${specifier}"`

	if (specifier.startsWith(MEDPLUM_IMPORT) && project.name !== CLINICAL_RECORD_ADAPTER) {
		findings.push({
			where,
			what,
			reason: "`@medplum/*` loads only in the clinical record adapter",
			source: "ADR-002 ř. 21 ve znění ADR-042 bod 6, ADR-054 bod 3",
		})
	}

	if (!project.tags.includes(WORKER_PROCESS_TAG)) {
		const workerOnly = WORKER_ONLY_EXTERNAL_IMPORTS.find((lib) => specifier === lib || specifier.startsWith(`${lib}/`))
		if (workerOnly !== undefined) {
			findings.push({
				where,
				what,
				reason: "the DICOM library and OCR load only in projects tagged process:worker",
				source: "ADR-005 ř. 38–39",
			})
		}
	}

	if (project.tags.includes(LAYER.ADAPTER)) {
		for (const owner of PORT_OWNERS) {
			if (specifier === owner || (specifier.startsWith(`${owner}/`) && specifier !== `${owner}/ports`)) {
				findings.push({
					where,
					what,
					reason: `an adapter knows only its port — import \`${owner}/ports\`, nothing else`,
					source: "ADR-003 ř. 26",
				})
			}
		}
	}

	const target = importedProject(specifier, projects)
	if (target !== undefined && target.name !== project.name) {
		if (target.name === DICOM_PROJECTION && !DICOM_PROJECTION_DEPENDENTS.includes(project.name)) {
			findings.push({ where, what, reason: DICOM_PROJECTION_REASON, source: DICOM_PROJECTION_SOURCE })
		}
		for (const rule of tagRules) {
			const tag = project.tags.includes(rule.subject) ? violatedTag(rule, target) : undefined
			if (tag !== undefined) {
				findings.push({ where, what: `${what} (${tag})`, reason: rule.reason, source: rule.source })
			}
		}
	}

	return findings
}
