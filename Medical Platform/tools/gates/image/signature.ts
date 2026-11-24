import type { Finding } from "./finding"
import { COSIGN_IMAGE, runDocker } from "./tools"

const GATE = "B7"

export const DISTROLESS_ISSUER = "https://accounts.google.com"
export const DISTROLESS_IDENTITY = "keyless@distroless.iam.gserviceaccount.com"

export function verifySignature(reference: string): Finding[] {
	const result = runDocker([
		COSIGN_IMAGE,
		"verify",
		"--certificate-oidc-issuer",
		DISTROLESS_ISSUER,
		"--certificate-identity",
		DISTROLESS_IDENTITY,
		"--output",
		"text",
		reference,
	])
	if (result.status === 0) {
		return []
	}
	const reason =
		result.output.split("\n").find((line) => line.startsWith("Error:")) ?? `cosign exited with ${result.status}`
	return [{ gate: GATE, what: reference, reason: `signature not verified: ${reason}` }]
}
