import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type LoginMethodOverrides = Schemas["LoginMethodOverrides"]

export type EffectiveLoginMethod = Schemas["EffectiveLoginMethod"]

export type LoginMethodSource = EffectiveLoginMethod["source"]

export type QuickLoginMethod = Exclude<EffectiveLoginMethod["method"], "oidc">

export type SettingWarning = Schemas["ConfigurationWarning"]
