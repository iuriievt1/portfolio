import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type Configuration = Schemas["Configuration"]

export type ConfigurationItem = Schemas["ConfigurationItem"]

export type ConfigurationChange = Schemas["ConfigurationChange"]

export type ConfigurationSaveResult = Schemas["ConfigurationSaveResult"]
