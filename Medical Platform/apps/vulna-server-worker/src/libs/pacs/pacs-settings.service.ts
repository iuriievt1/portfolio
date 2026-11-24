import {
	CONFIGURATION_KEY,
	type ConfigurationValues,
	integerValueOf,
	requiredIntegerOf,
	textValueOf,
} from "@ansora/core-server"
import type { DimseSettings } from "@ansora/vulna-adapter-dicom-dimse"
import { Injectable } from "@nestjs/common"
import { ImplementationIdentityService } from "./implementation-identity.service"
import { dimseTimeoutsOf, implementationClassUidOf } from "./utils/pacs-configuration"

// CAP-023-R02, CAP-023-R03, NAB-336, NAB-352, TS-145, integrace-dicom.md 6.3
@Injectable()
export class PacsSettingsService {
	constructor(private readonly identities: ImplementationIdentityService) {}

	dimseSettingsOf(values: ConfigurationValues): DimseSettings | undefined {
		const host = textValueOf(values, CONFIGURATION_KEY.PACS_HOST)
		const port = integerValueOf(values, CONFIGURATION_KEY.PACS_PORT)
		const pacsAeTitle = textValueOf(values, CONFIGURATION_KEY.PACS_AE_TITLE)
		const callingAeTitle = textValueOf(values, CONFIGURATION_KEY.PACS_CALLING_AE_TITLE)
		const implementationClassUid = implementationClassUidOf(values)
		if (
			host === undefined ||
			port === undefined ||
			pacsAeTitle === undefined ||
			callingAeTitle === undefined ||
			implementationClassUid === undefined
		) {
			return undefined
		}
		return {
			host,
			port,
			pacsAeTitle,
			callingAeTitle,
			worklistModality: textValueOf(values, CONFIGURATION_KEY.PACS_WORKLIST_MODALITY),
			identity: this.identities.identityOf(implementationClassUid),
			timeouts: dimseTimeoutsOf(values),
			maxPduLength: requiredIntegerOf(values, CONFIGURATION_KEY.DICOM_MAX_PDU_LENGTH),
		}
	}
}
