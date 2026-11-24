import { createHash, createPublicKey, X509Certificate } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { connect } from "node:tls"

/**
 * SPKI fingerprint for pinning ✓ CAP-010-R06: `sha256/` and the base64 SHA-256 of the DER
 * SubjectPublicKeyInfo, the form of RFC 7469 that the native modules verify.
 *
 * Input is a certificate (PEM or DER), a public or private key in PEM — the backup fingerprint
 * comes from the next key before its certificate exists ✓ CAP-010-R07 — or `host:port` of a running
 * server. The value goes into managed configuration or into the release ✓ ADR-019 ř. 58–59.
 */
const PREFIX = "sha256/"
const KEY_PEM = /-----BEGIN (?:EC |RSA )?(?:PUBLIC|PRIVATE) KEY-----/
const HOST_PORT = /^([^\s:/]+):(\d{1,5})$/
const TLS_TIMEOUT_MS = 10_000

export function fingerprintOfSpki(subjectPublicKeyInfo: Buffer): string {
	return PREFIX + createHash("sha256").update(subjectPublicKeyInfo).digest("base64")
}

export function fingerprintOfCertificate(certificate: Buffer | string): string {
	return fingerprintOfSpki(new X509Certificate(certificate).publicKey.export({ type: "spki", format: "der" }))
}

export function fingerprintOfKey(pem: string): string {
	return fingerprintOfSpki(createPublicKey(pem).export({ type: "spki", format: "der" }))
}

export function fingerprintOfFile(path: string): string {
	const content = readFileSync(path)
	const text = content.toString("utf8")
	return KEY_PEM.test(text) ? fingerprintOfKey(text) : fingerprintOfCertificate(content)
}

/** Reads the certificate the server presents; the administrator compares it with the one they issued. */
export function fingerprintOfServer(host: string, port: number): Promise<string> {
	return new Promise((fulfil, reject) => {
		const socket = connect({ host, port, servername: host, rejectUnauthorized: false, timeout: TLS_TIMEOUT_MS }, () => {
			const certificate = socket.getPeerX509Certificate()
			socket.end()
			if (certificate === undefined) {
				reject(new Error(`No certificate from ${host}:${port}`))
				return
			}
			fulfil(fingerprintOfSpki(certificate.publicKey.export({ type: "spki", format: "der" })))
		})
		socket.on("timeout", () => socket.destroy(new Error(`No TLS handshake with ${host}:${port} in time`)))
		socket.on("error", reject)
	})
}

async function fingerprintOf(input: string): Promise<string> {
	const server = HOST_PORT.exec(input)
	if (server !== null) {
		return fingerprintOfServer(server[1] as string, Number(server[2]))
	}
	return fingerprintOfFile(resolve(process.env.INIT_CWD ?? process.cwd(), input))
}

async function main(inputs: string[]): Promise<void> {
	if (inputs.length === 0) {
		console.error("Usage: pnpm pinning:fingerprint <certificate.pem|certificate.der|key.pem|host:port> ...")
		process.exitCode = 2
		return
	}
	for (const input of inputs) {
		console.log(`${await fingerprintOf(input)}\t${input}`)
	}
}

if (require.main === module) {
	main(process.argv.slice(2)).catch((failure: Error) => {
		console.error(failure.message)
		process.exitCode = 1
	})
}
