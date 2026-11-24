// CAP-015-R36, CAP-019-R14, CAP-021-R07, ADR-015
export class RejectedContentError extends Error {
	constructor(
		readonly reason: string,
		readonly isAnnouncedFile: boolean,
	) {
		super(reason)
		this.name = "RejectedContentError"
	}
}
