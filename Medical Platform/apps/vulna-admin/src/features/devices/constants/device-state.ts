import type { Device } from "@/features/devices/types/device.types"

export const PENDING_APPROVAL: Device["state"] = "pending_approval"

export const APPROVED: Device["state"] = "approved"

export const REVOKED: Device["state"] = "revoked"

export const BLOCKED: Device["state"] = "blocked"

export const DEVICE_STATES: readonly Device["state"][] = [PENDING_APPROVAL, APPROVED, BLOCKED, REVOKED]
