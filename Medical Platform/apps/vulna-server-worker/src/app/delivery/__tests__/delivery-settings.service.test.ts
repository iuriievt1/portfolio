import { CONFIGURATION_KEY } from "@ansora/core-server"
import { TRANSFER_SYNTAX } from "@ansora/vulna-projection-dicom"
import { describe, expect, it } from "vitest"
import type { ConfigurationService } from "../../../libs/configuration/configuration.service"
import type { PacsSettingsService } from "../../../libs/pacs/pacs-settings.service"
import { DeliverySettingsService } from "../services/delivery-settings.service"
import type { DeliveryArchive } from "../types/delivery.types"
import { deliveryLeaseMillisecondsOf } from "../utils/delivery-timing"

const ARCHIVE = {} as DeliveryArchive
const CONNECT_SECONDS = 10
const ACSE_SECONDS = 30
const DIMSE_SECONDS = 120
const LEASE_MILLISECONDS = 160_000

const VALUES = new Map<string, unknown>([
	[CONFIGURATION_KEY.DELIVERY_MAX_ATTEMPTS, 5],
	[CONFIGURATION_KEY.DELIVERY_RETRY_BACKOFF_MIN_SECONDS, 60],
	[CONFIGURATION_KEY.DELIVERY_RETRY_BACKOFF_MAX_SECONDS, 3600],
	[CONFIGURATION_KEY.DELIVERY_VERIFICATION_DELAY_SECONDS, 60],
	[CONFIGURATION_KEY.VERIFICATION_REJECTIONS_BEFORE_ALERT, 3],
	[CONFIGURATION_KEY.TARGET_UNAVAILABLE_ALERT_SECONDS, 3600],
	[CONFIGURATION_KEY.DICOM_IMAGE_TRANSFER_SYNTAXES, [TRANSFER_SYNTAX.JPEG_BASELINE]],
	[CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES, [TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN]],
	[CONFIGURATION_KEY.DICOM_CONNECT_TIMEOUT_SECONDS, CONNECT_SECONDS],
	[CONFIGURATION_KEY.DICOM_ACSE_TIMEOUT_SECONDS, ACSE_SECONDS],
	[CONFIGURATION_KEY.DICOM_DIMSE_TIMEOUT_SECONDS, DIMSE_SECONDS],
	[CONFIGURATION_KEY.DICOM_IDLE_TIMEOUT_SECONDS, 300],
])

function settingsWith(values: ReadonlyMap<string, unknown>) {
	const configuration = { effectiveValues: async () => values } as unknown as ConfigurationService
	const pacs = { dimseSettingsOf: () => ({}) } as unknown as PacsSettingsService
	return new DeliverySettingsService(configuration, pacs, () => ARCHIVE)
}

describe("delivery settings from the effective configuration ✓ konfigurace-a-profily.md 2.7", () => {
	it("CAP-023-R15 takes the configured transfer syntaxes as the order of preference", async () => {
		expect(await settingsWith(VALUES).current()).toMatchObject({
			archive: ARCHIVE,
			maxAttempts: 5,
			backoff: { minimumSeconds: 60, maximumSeconds: 3600 },
			transferSyntaxPreference: {
				image: [TRANSFER_SYNTAX.JPEG_BASELINE],
				document: [TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN],
			},
		})
	})

	it("integrace-dicom.md 3 waits while a configured transfer syntax is one the server cannot send", async () => {
		const values = new Map(VALUES)
		values.set(CONFIGURATION_KEY.DICOM_IMAGE_TRANSFER_SYNTAXES, ["1.2.840.10008.1.2.4.91"])

		expect(await settingsWith(values).current()).toBeUndefined()
	})

	it("CAP-023-R25 holds the lease longer than connecting, associating and one DIMSE answer", () => {
		expect(deliveryLeaseMillisecondsOf(VALUES)).toBe(LEASE_MILLISECONDS)
	})
})
