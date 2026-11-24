import { CONFIGURATION_KEY, type ConfigurationValues, requiredIntegerOf } from "@ansora/core-server"
import { DOCUMENT_TRANSFER_SYNTAXES, IMAGE_TRANSFER_SYNTAXES } from "@ansora/vulna-projection-dicom"
import { Inject, Injectable, Logger } from "@nestjs/common"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { PacsSettingsService } from "../../../libs/pacs/pacs-settings.service"
import { transferSyntaxesOf } from "../../../libs/pacs/utils/pacs-configuration"
import { DELIVERY_ARCHIVE_FACTORY } from "../constants/delivery.constants"
import type {
	DeliveryArchive,
	DeliveryArchiveFactory,
	DeliverySettings,
	TransferSyntaxPreference,
} from "../types/delivery.types"

// konfigurace-a-profily.md 2.1, 2.7, CAP-023-R02, CAP-023-R10, CAP-023-R26, CAP-023-R27
@Injectable()
export class DeliverySettingsService {
	private readonly logger = new Logger(DeliverySettingsService.name)
	private lastWait: string | undefined

	constructor(
		private readonly configuration: ConfigurationService,
		private readonly pacs: PacsSettingsService,
		@Inject(DELIVERY_ARCHIVE_FACTORY) private readonly archiveFor: DeliveryArchiveFactory,
	) {}

	async current(): Promise<DeliverySettings | undefined> {
		const values = await this.configuration.effectiveValues()
		const archive = this.archiveOf(values)
		const transferSyntaxPreference = this.transferSyntaxPreferenceOf(values)
		if (archive === undefined || transferSyntaxPreference === undefined) {
			return undefined
		}
		this.lastWait = undefined
		return {
			archive,
			maxAttempts: requiredIntegerOf(values, CONFIGURATION_KEY.DELIVERY_MAX_ATTEMPTS),
			backoff: {
				minimumSeconds: requiredIntegerOf(values, CONFIGURATION_KEY.DELIVERY_RETRY_BACKOFF_MIN_SECONDS),
				maximumSeconds: requiredIntegerOf(values, CONFIGURATION_KEY.DELIVERY_RETRY_BACKOFF_MAX_SECONDS),
			},
			verificationDelaySeconds: requiredIntegerOf(values, CONFIGURATION_KEY.DELIVERY_VERIFICATION_DELAY_SECONDS),
			rejectionsBeforeAlert: requiredIntegerOf(values, CONFIGURATION_KEY.VERIFICATION_REJECTIONS_BEFORE_ALERT),
			unavailableAlertSeconds: requiredIntegerOf(values, CONFIGURATION_KEY.TARGET_UNAVAILABLE_ALERT_SECONDS),
			transferSyntaxPreference,
		}
	}

	// CAP-023-R24
	private archiveOf(values: ConfigurationValues): DeliveryArchive | undefined {
		const settings = this.pacs.dimseSettingsOf(values)
		if (settings === undefined) {
			this.waits("the PACS connection or the Implementation Class UID is not configured")
			return undefined
		}
		try {
			return this.archiveFor(settings)
		} catch (error) {
			this.waits(`the PACS connection in the configuration is not valid: ${String(error)}`)
			return undefined
		}
	}

	// integrace-dicom.md 3, CAP-023-R15
	private transferSyntaxPreferenceOf(values: ConfigurationValues): TransferSyntaxPreference | undefined {
		const image = transferSyntaxesOf(values, CONFIGURATION_KEY.DICOM_IMAGE_TRANSFER_SYNTAXES, IMAGE_TRANSFER_SYNTAXES)
		const document = transferSyntaxesOf(
			values,
			CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES,
			DOCUMENT_TRANSFER_SYNTAXES,
		)
		if (image === undefined || document === undefined) {
			this.waits("the configured transfer syntaxes are not supported")
			return undefined
		}
		return { image, document }
	}

	private waits(reason: string): void {
		if (this.lastWait === reason) {
			return
		}
		this.lastWait = reason
		this.logger.warn(`Delivery to the PACS waits: ${reason}`)
	}
}
