import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const PRIVATE_FILE_MODE = 0o600
const DIRECTORY_MODE = 0o700

export function writePrivateKeyFile(directory: string, version: string, pem: string): string {
	const path = join(directory, `${version}.pem`)
	mkdirSync(directory, { recursive: true, mode: DIRECTORY_MODE })
	writeFileSync(path, pem, { mode: PRIVATE_FILE_MODE, flag: "wx" })
	return path
}
