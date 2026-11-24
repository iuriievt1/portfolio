import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type Device = Schemas["Device"]

export type DeviceQueue = NonNullable<Device["queue"]>

export type DevicesPage = Schemas["DevicesPage"]

export type DeviceApproval = Schemas["DeviceApproval"]

export type BlockingReview = Schemas["BlockingReview"]

export type DeviceUnblockingRecord = NonNullable<Device["unblocking"]>

export type BlockedPredecessor = NonNullable<Device["blocked_predecessor"]>

export type DeviceUnblocking =
	AdministrationContract.operations["unblockDevice"]["requestBody"]["content"]["application/json"]

export type DeviceSaveResult = Schemas["DeviceSaveResult"]

export type GroupAssignment = Schemas["GroupAssignment"]
