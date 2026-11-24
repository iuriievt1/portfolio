import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type OrphanedObject = Schemas["OrphanedObject"]

export type OrphanedObjectsPage = Schemas["OrphanedObjectsPage"]

export type OrphanedObjectDeletion = Schemas["OrphanedObjectDeletion"]
