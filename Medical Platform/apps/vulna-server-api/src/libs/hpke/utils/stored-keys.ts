import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { StoredServerKey } from "@ansora/core-server"

const KEY_FILE_EXTENSION = ".pem"

/** Every `<version>.pem` in the key directory; the file stem is the version ✓ `docs/spec/backend.md` kap. 2.2. */
export function readStoredKeys(directory: string): StoredServerKey[] {
	return readdirSync(directory)
		.filter((file) => file.endsWith(KEY_FILE_EXTENSION))
		.sort()
		.map((file) => ({
			version: file.slice(0, -KEY_FILE_EXTENSION.length),
			pem: readFileSync(join(directory, file), "utf8"),
		}))
}
