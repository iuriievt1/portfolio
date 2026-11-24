import { describe, expect, it } from "vitest"
import {
	authorizationEndpointMismatchOf,
	deviceBlockingOf,
	localDataDeletionOf,
} from "@/features/audit/lib/device-event-details"

const DELETION = { reason: "device_revocation", count: 3, oldest_acquired_at: "2026-10-25T14:00:00.000Z" }

describe("events reported by the device in the audit log CAP-025-R22", () => {
	it("CAP-007-R08 reads the reason, the count and the oldest item of a local data deletion", () => {
		expect(localDataDeletionOf({ event_type: "local-data-deletion", details: DELETION })).toEqual(DELETION)
	})

	it("ignores details that do not belong to the event type or are malformed", () => {
		expect(localDataDeletionOf({ event_type: "device-revocation", details: DELETION })).toBeUndefined()
		expect(
			localDataDeletionOf({ event_type: "local-data-deletion", details: { ...DELETION, count: 1.5 } }),
		).toBeUndefined()
		expect(localDataDeletionOf({ event_type: "local-data-deletion", details: null })).toBeUndefined()
	})

	it("CAP-001-R32 reads the compared addresses of an authorization endpoint mismatch", () => {
		const details = {
			server_authorization_endpoint: "https://idp.example/authorize",
			provider_authorization_endpoint: null,
			discovery_url: "https://idp.example/.well-known/openid-configuration",
		}
		expect(authorizationEndpointMismatchOf({ event_type: "authorization-endpoint-mismatch", details })).toEqual(details)
	})

	it("ignores a mismatch whose addresses are missing or not text", () => {
		const reported = (details: Record<string, unknown>) =>
			authorizationEndpointMismatchOf({ event_type: "authorization-endpoint-mismatch", details })
		expect(reported({ server_authorization_endpoint: "https://idp.example/authorize" })).toBeUndefined()
		expect(
			reported({
				server_authorization_endpoint: "https://idp.example/authorize",
				provider_authorization_endpoint: 7,
				discovery_url: "https://idp.example/.well-known/openid-configuration",
			}),
		).toBeUndefined()
		expect(authorizationEndpointMismatchOf({ event_type: "local-data-deletion", details: {} })).toBeUndefined()
	})

	it("CAP-008-S07 reads what the device reported with its block and keeps the reported order of signals", () => {
		const details = { signals: ["debugger", "root"], detected_at: "2026-10-29T08:00:00.000Z", app_version: "1.0.0" }
		expect(deviceBlockingOf({ event_type: "device-blocking", details })).toEqual(details)
	})

	it("ignores a block with an unknown, missing or empty signal list or without the app version", () => {
		const details = { signals: ["root"], detected_at: "2026-10-29T08:00:00.000Z", app_version: "1.0.0" }
		const reported = (changed: Record<string, unknown>) =>
			deviceBlockingOf({ event_type: "device-blocking", details: { ...details, ...changed } })
		expect(reported({ signals: ["root", "xposed"] })).toBeUndefined()
		expect(reported({ signals: [] })).toBeUndefined()
		expect(reported({ signals: "root" })).toBeUndefined()
		expect(reported({ app_version: null })).toBeUndefined()
		expect(deviceBlockingOf({ event_type: "device-revocation", details })).toBeUndefined()
	})
})
