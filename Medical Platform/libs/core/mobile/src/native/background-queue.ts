import { requireNativeModule } from "expo"
import type { BackgroundQueue, BackgroundQueueEvents } from "./index"
import type { EventEmittingModule } from "./native-module"

const MODULE_NAME = "BackgroundQueue"

export type BackgroundQueueModule = EventEmittingModule<BackgroundQueue, BackgroundQueueEvents>

export function backgroundQueue(): BackgroundQueueModule {
	return requireNativeModule<BackgroundQueueModule>(MODULE_NAME)
}
