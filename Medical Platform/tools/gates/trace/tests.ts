import { globSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import ts from "typescript"
import { idsIn, malformedScenarioIds, SCENARIO_ID } from "./ids"

export interface TestFile {
	path: string
	scenarios: string[]
	malformed: string[]
}

const TESTS_KEY = /^tests: (\[.*\])$/m
const TEST_FUNCTIONS = new Set(["describe", "it", "test"])

export function testGlobs(readme: string): string[] {
	const match = TESTS_KEY.exec(readme)
	return match?.[1] === undefined ? [] : (JSON.parse(match[1]) as string[])
}

export function findTestFiles(root: string, globs: readonly string[]): string[] {
	const files = globSync([...globs], { cwd: root, exclude: (name) => name === "node_modules" || name === "dist" })
	return [...new Set(files)].sort()
}

function calleeName(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) {
		return expression.text
	}
	if (ts.isPropertyAccessExpression(expression) || ts.isCallExpression(expression)) {
		return calleeName(expression.expression)
	}
	return undefined
}

export function testNames(source: string, path: string): string[] {
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
	const names: string[] = []
	const walk = (node: ts.Node): void => {
		if (ts.isCallExpression(node)) {
			const name = calleeName(node.expression)
			const first = node.arguments[0]
			if (
				name !== undefined &&
				TEST_FUNCTIONS.has(name) &&
				first !== undefined &&
				(ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
			) {
				names.push(first.text)
			}
		}
		ts.forEachChild(node, walk)
	}
	walk(file)
	return names
}

export function readTestFile(root: string, path: string): TestFile {
	const names = testNames(readFileSync(join(root, path), "utf8"), path).join("\n")
	return {
		path: relative(root, join(root, path)),
		scenarios: idsIn(names, SCENARIO_ID),
		malformed: malformedScenarioIds(names),
	}
}
