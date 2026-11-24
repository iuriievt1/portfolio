import { execFileSync } from "node:child_process"

export const COSIGN_IMAGE =
	"gcr.io/projectsigstore/cosign:v3.1.3@sha256:9e5c2f2edc34351160407ca3416c61855bdf9403c3c5936e0f0be7fc261611b8"
export const TRIVY_IMAGE =
	"aquasec/trivy:0.74.0@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969"

export interface DockerResult {
	status: number
	output: string
}

export function runDocker(args: readonly string[]): DockerResult {
	try {
		return { status: 0, output: execFileSync("docker", ["run", "--rm", ...args], { encoding: "utf8", stdio: "pipe" }) }
	} catch (error) {
		const failure = error as { status?: number; stdout?: string; stderr?: string }
		return { status: failure.status ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` }
	}
}

export function toolVersion(image: string): string {
	return image.split("@")[0]?.split(":").pop() ?? "unknown"
}
