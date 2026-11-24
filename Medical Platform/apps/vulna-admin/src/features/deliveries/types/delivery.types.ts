import type { AdministrationContract, DeliveryInstanceState, DeliveryState } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type Delivery = Schemas["Delivery"]

export type DeliveryInstance = Schemas["DeliveryInstance"]

export type DeliveryTarget = Schemas["DeliveryTarget"]

export type DeliveriesPage = Schemas["DeliveriesPage"]

export type DeliveryClosure = Schemas["DeliveryClosure"]

export type TextRecognitionRestart = Schemas["TextRecognitionRestart"]

// administration.yaml listDeliveries
export interface DeliveryFilter {
	state: DeliveryState | undefined
	instanceState: DeliveryInstanceState | undefined
}
