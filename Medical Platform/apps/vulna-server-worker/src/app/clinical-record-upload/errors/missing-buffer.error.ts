// CAP-021-R35, CAP-021-R36
export class MissingBufferError extends Error {
	constructor(binaryObjectId: string) {
		super(`the buffer holds no bytes of binary object ${binaryObjectId}`)
		this.name = "MissingBufferError"
	}
}
