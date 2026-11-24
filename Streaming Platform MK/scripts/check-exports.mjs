#!/usr/bin/env node
/**
 * Guard: verifies all barrel exports in @pkg/design-system resolve correctly.
 *
 * Checks:
 * 1. Every export in design-system/index.ts points to a resolvable module
 * 2. Every import in compound index files (Hero/index.ts, Rail/index.ts) resolves
 * 3. Re-export index files actually point to existing web files
 *
 * Run: pnpm check:exports
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const DS = 'packages/design-system'
const errors = []
const warnings = []

// ── Helpers ────────────────────────────────────────────────────

/** Try resolving a TS/TSX import path from a given file */
function resolveImport(fromFile, importPath) {
	const dir = dirname(fromFile)
	const target = join(dir, importPath)

	// Direct file match
	const exts = ['.ts', '.tsx', '.web.tsx']
	for (const ext of exts) {
		if (existsSync(target + ext)) return target + ext
	}

	// Directory with index
	if (existsSync(join(target, 'index.ts'))) return join(target, 'index.ts')
	if (existsSync(join(target, 'index.tsx'))) return join(target, 'index.tsx')

	// Already has extension
	if (existsSync(target)) return target

	return null
}

/** Extract all import/export from paths in a TS file */
function extractImportPaths(filePath) {
	const src = readFileSync(filePath, 'utf8')
	// Match: from './something' or from '../something'
	const regex = /from\s+['"](\.[^'"]+)['"]/g
	return Array.from(src.matchAll(regex), (match) => ({
		path: match[1],
		line: src.substring(0, match.index).split('\n').length,
	}))
}

/** Check if a base path has web platform file */
function checkPlatformFiles(basePath) {
	return { web: existsSync(`${basePath}.web.tsx`) }
}

// ── 1. Verify design-system/index.ts exports ──────────────────

const dsIndex = join(DS, 'index.ts')
const dsImports = extractImportPaths(dsIndex)

for (const { path, line } of dsImports) {
	const resolved = resolveImport(dsIndex, path)
	if (!resolved) {
		errors.push(`BROKEN EXPORT: ${relative('.', dsIndex)}:${line} — '${path}' cannot be resolved`)
	}
}

// ── 2. Verify compound index files ────────────────────────────

const compoundIndexes = [
	join(DS, 'components/features/Hero/index.ts'),
	join(DS, 'components/features/Rail/index.ts'),
	join(DS, 'components/features/Rail/Card/index.ts'),
	join(DS, 'components/ui/AppBar/index.ts'),
	join(DS, 'components/ui/Footer/index.ts'),
]

for (const indexFile of compoundIndexes) {
	if (!existsSync(indexFile)) continue
	const imports = extractImportPaths(indexFile)

	for (const { path, line } of imports) {
		const resolved = resolveImport(indexFile, path)
		if (!resolved) {
			errors.push(`BROKEN IMPORT: ${relative('.', indexFile)}:${line} — '${path}' cannot be resolved`)
		}
	}
}

// ── 3. Re-export index files: verify targets have web files ──

const primitivesDirs = [
	'components/primitives/Avatar',
	'components/primitives/Badge',
	'components/primitives/Image',
	'components/primitives/Link',
	'components/primitives/ProgressBar',
	'components/primitives/SearchInput',
	'components/primitives/Skeleton',
	'components/primitives/TruncatedText',
]

for (const subDir of primitivesDirs) {
	const indexPath = join(DS, subDir, 'index.ts')
	if (!existsSync(indexPath)) {
		errors.push(`MISSING INDEX: ${relative('.', join(DS, subDir))} — no index.ts for barrel export`)
		continue
	}

	const imports = extractImportPaths(indexPath)
	for (const { path } of imports) {
		const basePath = join(DS, subDir, path)
		const platforms = checkPlatformFiles(basePath)

		if (!platforms.web) {
			// Maybe it's a plain .ts/.tsx file (types, hooks)
			if (!existsSync(`${basePath}.ts`) && !existsSync(`${basePath}.tsx`)) {
				errors.push(`DEAD EXPORT: ${relative('.', indexPath)} exports '${path}' but no file found`)
			}
		}
	}
}

// ── 4. Compound sub-components: verify referenced files exist ──

const heroIndex = join(DS, 'components/features/Hero/index.ts')
if (existsSync(heroIndex)) {
	const imports = extractImportPaths(heroIndex)
	for (const { path, line } of imports) {
		const basePath = join(dirname(heroIndex), path)
		if (!existsSync(`${basePath}.web.tsx`) && !existsSync(`${basePath}.ts`) && !existsSync(`${basePath}.tsx`)) {
			errors.push(`MISSING: ${relative('.', heroIndex)}:${line} — '${path}' cannot be resolved for web`)
		}
	}
}

const railIndex = join(DS, 'components/features/Rail/index.ts')
if (existsSync(railIndex)) {
	const imports = extractImportPaths(railIndex)
	for (const { path, line } of imports) {
		const resolved = resolveImport(railIndex, path)
		if (!resolved) {
			errors.push(`MISSING: ${relative('.', railIndex)}:${line} — '${path}' cannot be resolved`)
		}
	}
}

// ── 5. Tokens barrel ──────────────────────────────────────────

const tokensIndex = join(DS, 'tokens/index.ts')
if (existsSync(tokensIndex)) {
	const imports = extractImportPaths(tokensIndex)
	for (const { path, line } of imports) {
		const resolved = resolveImport(tokensIndex, path)
		if (!resolved) {
			errors.push(`BROKEN TOKEN EXPORT: ${relative('.', tokensIndex)}:${line} — '${path}' cannot be resolved`)
		}
	}
}

// ── Report ─────────────────────────────────────────────────────

console.log('')
if (errors.length > 0) {
	console.error(`check-exports FAILED — ${errors.length} error(s):\n`)
	for (const e of errors) console.error(`  ${e}`)
}

if (warnings.length > 0) {
	console.warn(`\n${warnings.length} warning(s):\n`)
	for (const w of warnings) console.warn(`  ${w}`)
}

if (errors.length === 0) {
	console.log(`check-exports passed — all barrel exports resolve correctly.`)
} else {
	console.error(`\nFix ${errors.length} error(s) before merging.`)
	process.exit(1)
}
