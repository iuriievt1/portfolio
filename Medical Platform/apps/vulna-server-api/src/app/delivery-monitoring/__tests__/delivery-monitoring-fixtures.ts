import { ACQUISITION_KIND, DELIVERY_STATE, DELIVERY_TARGET } from "@ansora/contracts"
import { PERMISSION, PERMISSIONS } from "@ansora/core-server"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { DeliveryView } from "../types/delivery-monitoring.types"

export const DELIVERY_ID = "22222222-2222-4222-8222-222222222222"
export const INSTANCE_ID = "33333333-3333-4333-8333-333333333333"
export const ACQUISITION_ID = "44444444-4444-4444-8444-444444444444"
export const ACQUISITION_CLOSED_AT = "2026-11-09T10:12:00.000Z"
export const ALERT_ID = "a0000000-0000-4000-8000-000000000009"
export const PACS = DELIVERY_TARGET.PACS
export const RESTART_REASON = "Nástroj OCR měl málo paměti, opraveno."

export const ADMINISTRATOR: AdministrationSession = {
	sessionId: "9e8d7c6b-5a49-4382-8170-6f5e4d3c2b1a",
	userId: "3f0d1c2e-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
	permissions: PERMISSIONS,
}

// CAP-003-R13
export const READER: AdministrationSession = {
	sessionId: "8d7c6b5a-4938-4271-8f6e-5d4c3b2a1908",
	userId: "4e1d2c3b-5a6f-4c7d-8e9f-0a1b2c3d4e5f",
	permissions: [PERMISSION.ADMINISTRATION_ACCESS],
}

export const DELIVERY: DeliveryView = {
	delivery_id: DELIVERY_ID,
	acquisition_id: ACQUISITION_ID,
	acquisition_kind: ACQUISITION_KIND.PHOTO,
	acquisition_closed_at: ACQUISITION_CLOSED_AT,
	target: PACS,
	state: DELIVERY_STATE.ASSEMBLED,
	reason: null,
	instance: [],
}
