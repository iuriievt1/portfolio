import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type DeviceGroup = Schemas["DeviceGroup"]

export type DeviceGroupWrite = Schemas["DeviceGroupWrite"]

export type DeviceGroupSaveResult = Schemas["DeviceGroupSaveResult"]

export type GroupLoginMethodsApplication = Schemas["GroupLoginMethodsApplication"]
