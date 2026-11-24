// CAP-021-R36
export class DigestMismatchError extends Error {
	constructor(binaryObjectId: string, clinicalRecordBinaryId: string) {
		super(`binary ${clinicalRecordBinaryId} does not hold the bytes of binary object ${binaryObjectId}`)
		this.name = "DigestMismatchError"
	}
}
