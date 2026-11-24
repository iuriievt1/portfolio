export class DeviceGroupCodeTakenError extends Error {
	constructor(readonly code: string) {
		super(`device group ${code} already exists`)
		this.name = "DeviceGroupCodeTakenError"
	}
}
