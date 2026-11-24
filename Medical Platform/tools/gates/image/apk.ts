import { runDocker } from "./tools"

export interface ApkPackage {
	name: string
	version: string
	architecture: string
	license: string
}

const INSTALLED_LINE = /^(.+?)-(\d\S*) (\S+) \{\S+\} \((.*)\) \[installed\]$/
const OWNER_LINE = /^(\S+) is owned by (.+?)-\d\S*$/
const UNOWNED_FILE = "Could not find owner package"

export function parseInstalledPackages(output: string): ApkPackage[] {
	return output.split("\n").flatMap((line) => {
		const [, name, version, architecture, license] = INSTALLED_LINE.exec(line.trim()) ?? []
		if (name === undefined || version === undefined || architecture === undefined || license === undefined) {
			return []
		}
		return [{ name, version, architecture, license }]
	})
}

export function parseOwners(output: string): Map<string, string> {
	const owners = new Map<string, string>()
	for (const line of output.split("\n")) {
		const [, file, owner] = OWNER_LINE.exec(line.trim()) ?? []
		if (file !== undefined && owner !== undefined) {
			owners.set(file, owner)
		}
	}
	return owners
}

function apk(image: string, ...args: string[]): string {
	const result = runDocker(["--entrypoint", "apk", image, ...args])
	if (result.status !== 0 && !result.output.includes(UNOWNED_FILE)) {
		throw new Error(`apk ${args[0]} in ${image} failed: ${result.output.trim()}`)
	}
	return result.output
}

export function installedPackages(image: string): ApkPackage[] {
	return parseInstalledPackages(apk(image, "list", "-I"))
}

export function ownersOf(image: string, files: readonly string[]): Map<string, string> {
	return files.length === 0 ? new Map() : parseOwners(apk(image, "info", "-W", ...files))
}
