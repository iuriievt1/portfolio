import { resolve } from "node:path"
import { generateQrSigningKeyPem, isQrKeyVersion } from "@ansora/core-server"
import { writePrivateKeyFile } from "../keys/private-key-file"

export function writeSigningKey(directory: string, version: string): string {
	if (!isQrKeyVersion(version)) {
		throw new Error(`The version ${version} is not a whole number`)
	}
	return writePrivateKeyFile(directory, version, generateQrSigningKeyPem())
}

function main(args: string[]): void {
	const [directory, version] = args
	if (directory === undefined || version === undefined) {
		console.error("Usage: pnpm qr:keygen <key directory> <version>")
		process.exitCode = 2
		return
	}
	const path = writeSigningKey(resolve(process.env.INIT_CWD ?? process.cwd(), directory), version)
	console.log(`private key\t${path}`)
	console.log(`version\t${version}`)
}

if (require.main === module) {
	try {
		main(process.argv.slice(2))
	} catch (failure) {
		console.error((failure as Error).message)
		process.exitCode = 1
	}
}
