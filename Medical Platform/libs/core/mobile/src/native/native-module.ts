import type { NativeModule } from "expo"

// biome-ignore lint/suspicious/noExplicitAny: expo EventsMap
type NativeEvents = Record<string, (...args: any[]) => void>

export type EventEmittingModule<Functions, Events extends NativeEvents> = Functions &
	InstanceType<typeof NativeModule<Events>>
