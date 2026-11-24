// CAP-020-R22, E125
export class ImageLinkError extends Error {
	constructor(readonly reason: unknown) {
		super("the signed image link could not be read")
		this.name = "ImageLinkError"
	}
}
