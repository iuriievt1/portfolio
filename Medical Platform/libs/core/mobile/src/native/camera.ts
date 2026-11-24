import { requireNativeModule } from "expo"
import type { Camera, CameraEvents } from "./index"
import type { EventEmittingModule } from "./native-module"

const MODULE_NAME = "Camera"

export type CameraModule = EventEmittingModule<Camera, CameraEvents>

export function camera(): CameraModule {
	return requireNativeModule<CameraModule>(MODULE_NAME)
}
