import { requireNativeModule } from "expo"
import type { ManagedConfiguration, ManagedConfigurationEvents } from "./index"
import type { EventEmittingModule } from "./native-module"

const MODULE_NAME = "ManagedConfiguration"

export type ManagedConfigurationModule = EventEmittingModule<ManagedConfiguration, ManagedConfigurationEvents>

export function managedConfiguration(): ManagedConfigurationModule {
	return requireNativeModule<ManagedConfigurationModule>(MODULE_NAME)
}
