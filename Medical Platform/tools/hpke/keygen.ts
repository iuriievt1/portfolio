import { resolve } from "node:path"
import { generateKeyPair, isKeyVersion, serializePublicKey } from "@ansora/core-server"
import { writePrivateKeyFile } from "../keys/private-key-file"

/**
 * A new version of the static server key pair for the HPKE envelope ✓ CAP-021-R21. The private key
 * goes into the key directory of the API process as `<version>.pem`, readable by nobody else
 * ✓ NAB-465; the public part is printed so the administrator can compare it with what devices pin.
 * Rotation: generate the next version, point `HPKE_CURRENT_KEY_VERSION` at it, restart the API
 * process, and remove the old file only when no queue item can still carry an envelope for it
 * ✓ `docs/spec/backend.md` kap. 2.2.
 */
export function writeServerKey(directory: string, version: string): { path: string; publicKey: string } {
	if (!isKeyVersion(version)) {
		throw new Error(`The version ${version} is not a short name of letters, digits, dot, dash and underscore`)
	}
	const privateKey = generateKeyPair()
	const path = writePrivateKeyFile(directory, version, privateKey.export({ type: "pkcs8", format: "pem" }).toString())
	return { path, publicKey: serializePublicKey(privateKey).toString("base64url") }
}

function main(args: string[]): void {
	const [directory, version] = args
	if (directory === undefined || version === undefined) {
		console.error("Usage: pnpm hpke:keygen <key directory> <version>")
		process.exitCode = 2
		return
	}
	const written = writeServerKey(resolve(process.env.INIT_CWD ?? process.cwd(), directory), version)
	console.log(`private key\t${written.path}`)
	console.log(`version\t${version}`)
	console.log(`public key\t${written.publicKey}`)
}

if (require.main === module) {
	try {
		main(process.argv.slice(2))
	} catch (failure) {
		console.error((failure as Error).message)
		process.exitCode = 1
	}
}
