import { existsSync, readFileSync } from "node:fs"

export function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf8")) as T
}

export function readJsonIfPresent<T>(path: string): T | undefined {
	return existsSync(path) ? readJson<T>(path) : undefined
}
