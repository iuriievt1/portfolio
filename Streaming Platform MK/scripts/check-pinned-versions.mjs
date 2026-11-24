#!/usr/bin/env node

/**
 * Pre-install guard: rejects `pnpm install` if any package.json has
 * unpinned dependency versions (^, ~, >=, >, <, *, latest).
 *
 * Runs as "preinstall" script — before pnpm resolves anything.
 * Allows: workspace:*, npm: aliases, exact versions.
 * Skips: peerDependencies (intentionally loose).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RANGE_RE = /^[\^~><=*]/
const errors = []

function check(filePath) {
	if (!existsSync(filePath)) return
	const rel = filePath.replace(`${root}/`, '')
	const pkg = JSON.parse(readFileSync(filePath, 'utf8'))

	for (const section of ['dependencies', 'devDependencies']) {
		for (const [name, version] of Object.entries(pkg[section] ?? {})) {
			if (version.startsWith('workspace:') || version.startsWith('npm:')) continue
			if (RANGE_RE.test(version) || version === 'latest') {
				errors.push(`  ${rel}  ${section} → ${name}: "${version}"`)
			}
		}
	}

	const overrides = pkg?.pnpm?.overrides ?? {}
	for (const [name, version] of Object.entries(overrides)) {
		if (version.startsWith('workspace:') || version.startsWith('npm:')) continue
		if (RANGE_RE.test(version) || version === 'latest') {
			errors.push(`  ${rel}  pnpm.overrides → ${name}: "${version}"`)
		}
	}
}

// Root
check(resolve(root, 'package.json'))

// Workspaces
for (const dir of ['apps', 'packages']) {
	const base = resolve(root, dir)
	if (!existsSync(base)) continue
	for (const sub of readdirSync(base, { withFileTypes: true })) {
		if (sub.isDirectory()) check(resolve(base, sub.name, 'package.json'))
	}
}

if (errors.length > 0) {
	console.error('\n✗ Unpinned dependency versions found — fix before installing:\n')
	for (const e of errors) console.error(e)
	console.error('\nPin to exact versions (remove ^, ~, >=, etc) then run pnpm install again.\n')
	process.exit(1)
}
