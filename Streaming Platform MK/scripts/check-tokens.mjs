#!/usr/bin/env node
/**
 * Guard: ensures tailwind-preset.ts has no hardcoded values.
 * Run in CI or as a pre-commit check.
 */
import { readFileSync } from 'node:fs'

const preset = readFileSync('packages/design-system/tailwind-preset.ts', 'utf8')
const errors = []

// Ban hardcoded rgb() strings — must use rgb() helper from primitives
const rgbLiterals = preset.match(/'rgb\(\d+,\d+,\d+\)'/g)
if (rgbLiterals) {
	errors.push(`Found ${rgbLiterals.length} hardcoded rgb() string(s) in preset:`)
	for (const m of rgbLiterals) errors.push(`  ${m}`)
}

// Ban hardcoded pixel strings — must use px() helper
const pxLiterals = preset.match(/'(\d+)px'/g)
if (pxLiterals) {
	errors.push(`Found ${pxLiterals.length} hardcoded px string(s) in preset:`)
	for (const m of pxLiterals) errors.push(`  ${m}`)
}

// Ban hardcoded ms strings — must use ms() helper
const msLiterals = preset.match(/'(\d+)ms'/g)
if (msLiterals) {
	errors.push(`Found ${msLiterals.length} hardcoded ms string(s) in preset:`)
	for (const m of msLiterals) errors.push(`  ${m}`)
}

// Guard: cn.ts font-size class groups must match token keys
const primitives = readFileSync('packages/design-system/tokens/primitives.ts', 'utf8')
const cn = readFileSync('packages/utils/cn.ts', 'utf8')

// Extract TYPOGRAPHY keys: match the object between `export const TYPOGRAPHY = {` and `} as const`
const typoBlock = primitives.match(/export const TYPOGRAPHY\s*=\s*\{([\s\S]*?)\}\s*as\s*const/)?.[1] ?? ''
const typoKeys = [...typoBlock.matchAll(/^\s*(?:'([^']+)'|(\w[\w-]*))\s*:/gm)].map((m) => m[1] || m[2])

// Extract FONT_SIZE keys that appear in the preset's fontSize section (only custom ones, not standard tailwind)
const standardSizes = new Set(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'])
const fsBlock = primitives.match(/export const FONT_SIZE\s*=\s*\{([\s\S]*?)\}\s*as\s*const/)?.[1] ?? ''
const fsKeys = [...fsBlock.matchAll(/^\s*(?:'([^']+)'|(\w[\w-]*))\s*:/gm)]
	.map((m) => m[1] || m[2])
	.filter((k) => !standardSizes.has(k))

// Check which custom font-size keys are registered in cn.ts
const allCustomKeys = [...new Set([...typoKeys, ...fsKeys])]
const missingInCn = allCustomKeys.filter((k) => !cn.includes(`'text-${k}'`))
if (missingInCn.length > 0) {
	errors.push(`cn.ts is missing ${missingInCn.length} custom font-size class(es) in tailwind-merge config:`)
	for (const k of missingInCn) errors.push(`  'text-${k}'`)
	errors.push(`  Add them to the 'font-size' classGroups array in packages/utils/cn.ts`)
}

if (errors.length > 0) {
	console.error('check-tokens failed:\n')
	for (const e of errors) console.error(e)
	console.error('\nAll values in tailwind-preset.ts must derive from token imports.')
	process.exit(1)
}

console.log('check-tokens passed — preset derives all values from tokens.')
