export class ConfigurationVersionConflictError extends Error {
	constructor(readonly version: number) {
		super(`configuration version ${version} already exists`)
	}
}
