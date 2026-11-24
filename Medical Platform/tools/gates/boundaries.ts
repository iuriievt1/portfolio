import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import ts from "typescript"
import {
	checkClinicalRecordReach,
	checkDicomProjectionDependents,
	checkImport,
	checkTagRule,
	type Finding,
	type Project,
} from "./boundary-check"
import { API_MUST_NOT_REACH, TAG_RULES } from "./rules"

// B15, ADR-033 bod 3, 6, architektura.md 2.3

const ROOT = resolve(__dirname, "../..")
const PROJECT_GLOBS = ["apps", "libs/contracts", "libs/core", "libs/modules"]
const SKIPPED = new Set(["node_modules", "dist", "out-tsc", ".expo", "android", "ios"])

function findProjects(): Map<string, Project> {
	const projects = new Map<string, Project>()

	const visit = (directory: string, depth: number): void => {
		const manifest = join(directory, "package.json")
		let isProject = false
		try {
			isProject = statSync(manifest).isFile()
		} catch {
			isProject = false
		}

		if (isProject) {
			const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
				name: string
				nx?: { tags?: string[] }
				dependencies?: Record<string, string>
			}
			const workspaceDeps = Object.entries(pkg.dependencies ?? {})
				.filter(([, range]) => range.startsWith("workspace:"))
				.map(([name]) => name)
			projects.set(pkg.name, {
				name: pkg.name,
				directory: relative(ROOT, directory),
				tags: pkg.nx?.tags ?? [],
				dependencies: workspaceDeps,
			})
			return
		}

		if (depth > 3) {
			return
		}
		for (const entry of readdirSync(directory)) {
			if (SKIPPED.has(entry)) {
				continue
			}
			const path = join(directory, entry)
			if (statSync(path).isDirectory()) {
				visit(path, depth + 1)
			}
		}
	}

	for (const glob of PROJECT_GLOBS) {
		visit(join(ROOT, glob), 0)
	}
	return projects
}

function sourceFiles(directory: string): string[] {
	const found: string[] = []
	for (const entry of readdirSync(directory)) {
		if (SKIPPED.has(entry)) {
			continue
		}
		const path = join(directory, entry)
		if (statSync(path).isDirectory()) {
			found.push(...sourceFiles(path))
		} else if (/\.(ts|tsx|mts|cts)$/.test(entry)) {
			found.push(path)
		}
	}
	return found
}

function importSpecifiers(path: string): string[] {
	const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true)
	const found: string[] = []

	const walk = (node: ts.Node): void => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier !== undefined &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			found.push(node.moduleSpecifier.text)
		}
		if (ts.isCallExpression(node)) {
			const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require"
			const isDynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword
			const first = node.arguments[0]
			if ((isRequire || isDynamic) && first !== undefined && ts.isStringLiteral(first)) {
				found.push(first.text)
			}
		}
		ts.forEachChild(node, walk)
	}

	walk(source)
	return found
}

function checkImports(allProjects: Map<string, Project>): Finding[] {
	const importFindings: Finding[] = []
	const tagRules = [...TAG_RULES, API_MUST_NOT_REACH]
	for (const project of allProjects.values()) {
		for (const file of sourceFiles(join(ROOT, project.directory))) {
			const where = relative(ROOT, file)
			for (const specifier of importSpecifiers(file)) {
				importFindings.push(...checkImport(project, where, specifier, allProjects, tagRules))
			}
		}
	}
	return importFindings
}

const projects = findProjects()
const findings = [
	...TAG_RULES.flatMap((rule) => checkTagRule(projects, rule)),
	...checkTagRule(projects, API_MUST_NOT_REACH),
	...checkClinicalRecordReach(projects),
	...checkDicomProjectionDependents(projects),
	...checkImports(projects),
]

process.stdout.write(`B15 package boundaries: ${projects.size} projects, ${TAG_RULES.length + 1} tag rules\n`)

if (findings.length === 0) {
	process.stdout.write("B15 package boundaries: clean\n")
} else {
	process.stderr.write(`\nB15 package boundaries: ${findings.length} violations\n\n`)
	for (const finding of findings) {
		process.stderr.write(`  ${finding.where}\n    ${finding.what}\n    ${finding.reason} ✓ ${finding.source}\n\n`)
	}
	process.exitCode = 1
}
