#!/usr/bin/env node

/**
 * Checks that critical packages have exactly ONE resolved version
 * in the pnpm monorepo. Catches the "silent duplicate" bug where
 * pnpm creates separate copies for different peer dependency contexts.
 *
 * Usage: node scripts/check-deps.mjs
 * Add to package.json: "health:deps": "node scripts/check-deps.mjs"
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Packages where duplicates cause real bugs (not just bloat)
const CRITICAL = [{ name: 'react', reason: 'Two copies → hooks crash ("Invalid hook call")' }]

// Packages where duplicates are wasteful but not breaking
const NICE_TO_HAVE = [
	{ name: 'lightningcss', reason: 'Two versions = wasted space (~3MB)' },
	{ name: 'react-dom', reason: 'Should match react version' },
	{ name: '@types/react', reason: 'Type conflicts between packages' },
]

/**
 * Parse `pnpm why <pkg>` output and extract only versions of THAT package.
 * `pnpm why react` shows the full tree, but we only want lines where
 * the package name itself appears with a version, e.g.:
 *   "react 19.1.0 peer"
 *   "├── react 19.1.0"
 *   "react-native-css-interop 0.2.2"
 */
function getVersions(pkg) {
	try {
		const output = execSync(`pnpm why ${pkg} 2>&1`, { cwd: root, encoding: 'utf8' })

		const versions = new Set()
		for (const line of output.split('\n')) {
			// Match lines containing exactly the package name followed by a version
			// Account for tree characters (├── ─ │ └──) and "peer" / "dev" suffixes
			// Escape dots and @ in package name for regex
			const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			const match = line.match(new RegExp(`(?:^|[│├└─\\s])\\s*${escaped}\\s+(\\d+\\.\\d+\\.\\d+[-\\w.]*)`, ''))
			if (match) {
				versions.add(match[1])
			}
		}

		return [...versions]
	} catch {
		return []
	}
}

/**
 * Alternative: parse pnpm-lock.yaml for resolved versions.
 * More reliable than `pnpm why` output parsing.
 */
function getVersionsFromLockfile(pkg) {
	try {
		const lockfile = readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8')
		const versions = new Set()

		// Match top-level package entries like:
		//   react-native-css-interop@0.2.2:
		//   react@19.1.0:
		const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		const pattern = new RegExp(`^  ${escaped}@(\\d+\\.\\d+\\.\\d+[-\\w.]*):\\s*$`, 'gm')
		for (const m of lockfile.matchAll(pattern)) {
			versions.add(m[1])
		}

		return [...versions]
	} catch {
		return []
	}
}

function checkNpmrc() {
	const npmrc = resolve(root, '.npmrc')
	if (!existsSync(npmrc)) {
		console.error('  FAIL: .npmrc not found')
		return false
	}

	const content = readFileSync(npmrc, 'utf8')
	let ok = true

	if (!content.includes('node-linker=hoisted')) {
		console.error('  FAIL: .npmrc missing "node-linker=hoisted"')
		ok = false
	}

	if (!content.includes('strict-peer-dependencies=false')) {
		console.error('  FAIL: .npmrc missing "strict-peer-dependencies=false" — install will fail')
		ok = false
	}

	if (ok) {
		console.log('  OK: .npmrc has correct settings (hoisted + relaxed peers)')
	}
	return ok
}

function checkOverrides() {
	try {
		const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
		const overrides = pkg?.pnpm?.overrides || {}
		const required = ['react']
		let ok = true

		for (const name of required) {
			if (!overrides[name]) {
				console.error(`  FAIL: Missing pnpm override for "${name}"`)
				ok = false
			} else {
				console.log(`  OK: ${name} → ${overrides[name]}`)
			}
		}

		return ok
	} catch {
		console.error('  FAIL: Could not read root package.json')
		return false
	}
}

// ── Workspace reference checks ──────────────────────────────────

/**
 * Verify all @pkg/* dependencies use `workspace:*` protocol.
 * Catches accidental version pinning that would pull from npm instead of local.
 */
function checkWorkspaceRefs() {
	const workspacePrefix = '@pkg/'
	const appDirs = ['apps/next']
	const pkgDirs = ['packages/app', 'packages/design-system', 'packages/utils']
	const allDirs = [...appDirs, ...pkgDirs]

	let ok = true

	for (const dir of allDirs) {
		const pkgPath = resolve(root, dir, 'package.json')
		if (!existsSync(pkgPath)) continue

		const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
		const allDeps = {
			...pkg.dependencies,
			...pkg.devDependencies,
		}

		for (const [name, version] of Object.entries(allDeps)) {
			if (name.startsWith(workspacePrefix) && version !== 'workspace:*') {
				console.error(`  FAIL: ${dir} → ${name}: "${version}" (should be "workspace:*")`)
				ok = false
			}
		}
	}

	if (ok) {
		console.log('  OK: All @pkg/* deps use workspace:* protocol')
	}
	return ok
}

// ── Tsconfig solution files ─────────────────────────────────────

/**
 * Verify packages have the expected tsconfig solution structure:
 * tsconfig.json (root with references) + tsconfig.web.json
 */
function checkTsconfigSolutionFiles() {
	const solutionPackages = ['packages/app', 'packages/design-system']
	const requiredConfigs = ['tsconfig.json', 'tsconfig.web.json']

	let ok = true

	for (const dir of solutionPackages) {
		const missing = requiredConfigs.filter((f) => !existsSync(resolve(root, dir, f)))

		if (missing.length > 0) {
			console.error(`  FAIL: ${dir} missing: ${missing.join(', ')}`)
			ok = false
		} else {
			console.log(`  OK: ${dir} has tsconfig solution files`)
		}
	}

	return ok
}

// --- Main ---

console.log('=== Monorepo Health Check ===\n')

// 1. .npmrc
console.log('[.npmrc]')
const npmrcOk = checkNpmrc()
console.log()

// 2. pnpm overrides
console.log('[pnpm overrides]')
const overridesOk = checkOverrides()
console.log()

// 3. Critical packages — check lockfile for resolved versions
console.log('[Critical Dependencies — duplicates = bugs]')
let criticalOk = true
for (const { name, reason } of CRITICAL) {
	const versions = getVersionsFromLockfile(name)
	if (versions.length === 0) {
		// Try pnpm why as fallback
		const whyVersions = getVersions(name)
		if (whyVersions.length === 0) {
			console.log(`  SKIP: ${name} (not in lockfile)`)
		} else if (whyVersions.length > 1) {
			console.error(`  FAIL: ${name} has ${whyVersions.length} versions: ${whyVersions.join(', ')}`)
			console.error(`        → ${reason}`)
			criticalOk = false
		} else {
			console.log(`  OK: ${name}@${whyVersions[0]}`)
		}
	} else if (versions.length > 1) {
		console.error(`  FAIL: ${name} has ${versions.length} versions in lockfile: ${versions.join(', ')}`)
		console.error(`        → ${reason}`)
		criticalOk = false
	} else {
		console.log(`  OK: ${name}@${versions[0]}`)
	}
}
console.log()

// 4. Nice-to-have
console.log('[Nice-to-Have — duplicates = waste]')
for (const { name, reason } of NICE_TO_HAVE) {
	const versions = getVersionsFromLockfile(name)
	if (versions.length === 0) {
		console.log(`  SKIP: ${name} (not in lockfile)`)
	} else if (versions.length > 1) {
		console.warn(`  WARN: ${name} has ${versions.length} versions: ${versions.join(', ')}`)
		console.warn(`        → ${reason}`)
	} else {
		console.log(`  OK: ${name}@${versions[0]}`)
	}
}
console.log()

// 5. Workspace references
console.log('[Workspace References — @pkg/* must use workspace:*]')
const workspaceOk = checkWorkspaceRefs()
console.log()

// 6. Tsconfig solution files
console.log('[Tsconfig Solution Files]')
const tsconfigOk = checkTsconfigSolutionFiles()
console.log()

// Summary
const allOk = npmrcOk && overridesOk && criticalOk && workspaceOk && tsconfigOk
if (allOk) {
	console.log('All checks passed.')
	process.exit(0)
} else {
	console.error('Some checks failed. See above for details.')
	process.exit(1)
}
