// CAP-017-R02, CAP-025-R30
export class WoundTypeLockedError extends Error {
	constructor(
		readonly findingId: string,
		readonly previousCode: string | null,
		readonly requestedCode: string,
		readonly codeListVersion: number,
	) {
		super(`the wound type of the finding ${findingId} is locked by a closed record`)
	}
}
