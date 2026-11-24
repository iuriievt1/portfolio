import { basename } from "node:path"
import type { Finding } from "./finding"

const GATE = "B11"

const BINARY_DIRECTORIES = ["/bin/", "/sbin/", "/usr/bin/", "/usr/sbin/", "/usr/local/bin/", "/nodejs/bin/"]

export const FORBIDDEN_BINARIES = [
	"sh",
	"bash",
	"dash",
	"ash",
	"zsh",
	"apt",
	"apt-get",
	"dpkg",
	"apk",
	"npm",
	"npx",
	"yarn",
	"corepack",
	"pnpm",
	"gcc",
	"cc",
	"c++",
	"g++",
	"make",
	"ld",
	"as",
	"python",
	"python3",
	"perl",
]

export function findForbidden(files: readonly string[]): Finding[] {
	const findings: Finding[] = []
	for (const file of files) {
		if (!BINARY_DIRECTORIES.some((directory) => file.startsWith(directory))) {
			continue
		}
		const name = basename(file)
		if (FORBIDDEN_BINARIES.includes(name) || name.startsWith("python")) {
			findings.push({ gate: GATE, what: file, reason: "shell, package manager or compiler in the image" })
		}
	}
	return findings
}
