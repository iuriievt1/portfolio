import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type AdministratorAlert = Schemas["AdministratorAlert"]

export type AdministratorAlertsPage = Schemas["AdministratorAlertsPage"]

export type OperationalMetrics = Schemas["OperationalMetrics"]
