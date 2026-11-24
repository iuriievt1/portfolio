import { CONFIGURATION_KEY, textValueOf } from "@ansora/core-server"
import { hasDicomTextsIn, isStringValue, LONG_STRING_MAX_LENGTH } from "@ansora/vulna-domain"
import { DOCUMENT_TRANSFER_SYNTAXES, IMAGE_TRANSFER_SYNTAXES } from "@ansora/vulna-projection-dicom"
import { Injectable } from "@nestjs/common"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { ImplementationIdentityService } from "../../../libs/pacs/implementation-identity.service"
import { implementationClassUidOf, transferSyntaxesOf } from "../../../libs/pacs/utils/pacs-configuration"
import { ASSEMBLY_PAUSE } from "../constants/assembly.constants"
import type { AssemblyPause, AssemblySettings } from "../types/assembly.types"
import { AssemblyPauseService } from "./assembly-pause.service"
import { ClosedRecordReaderService } from "./closed-record-reader.service"

// CAP-021-R17, CAP-012-R17, CAP-021-R26, CAP-013-R10, integrace-dicom.md 3, 4, 5.0, 5.1, 5.7, 5.8
@Injectable()
export class AssemblySettingsService {
	constructor(
		private readonly configuration: ConfigurationService,
		private readonly identities: ImplementationIdentityService,
		private readonly readers: ClosedRecordReaderService,
		private readonly pauses: AssemblyPauseService,
	) {}

	async current(): Promise<AssemblySettings | undefined> {
		const values = await this.configuration.effectiveValues()
		const implementationClassUid = implementationClassUidOf(values)
		if (implementationClassUid === undefined) {
			return await this.waiting(ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING)
		}
		const patientIdSystem = textValueOf(values, CONFIGURATION_KEY.PATIENT_CODE_SYSTEM)
		if (patientIdSystem === undefined) {
			return await this.waiting(ASSEMBLY_PAUSE.PATIENT_ID_SYSTEM_MISSING)
		}
		const language = textValueOf(values, CONFIGURATION_KEY.DEFAULT_LANGUAGE)
		if (language === undefined || !hasDicomTextsIn(language)) {
			return await this.waiting(ASSEMBLY_PAUSE.LANGUAGE_WITHOUT_TEXTS)
		}
		const imageTransferSyntaxes = transferSyntaxesOf(
			values,
			CONFIGURATION_KEY.DICOM_IMAGE_TRANSFER_SYNTAXES,
			IMAGE_TRANSFER_SYNTAXES,
		)
		const documentTransferSyntaxes = transferSyntaxesOf(
			values,
			CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES,
			DOCUMENT_TRANSFER_SYNTAXES,
		)
		if (imageTransferSyntaxes === undefined || documentTransferSyntaxes === undefined) {
			return await this.waiting(ASSEMBLY_PAUSE.TRANSFER_SYNTAXES_UNSUPPORTED)
		}
		const release = this.identities.release()
		if (release.trim() === "" || !isStringValue(release, LONG_STRING_MAX_LENGTH)) {
			return await this.waiting(ASSEMBLY_PAUSE.RELEASE_UNFIT)
		}
		const reader = this.readers.current(values)
		if (reader === undefined) {
			return await this.waiting(ASSEMBLY_PAUSE.CLINICAL_RECORD_STORE_UNCONFIGURED)
		}
		await this.pauses.resumed()
		return {
			imageTransferSyntaxes,
			documentTransferSyntaxes,
			identity: this.identities.identityOf(implementationClassUid),
			language,
			softwareVersion: release,
			patientIdSystem,
			reader,
		}
	}

	private async waiting(pause: AssemblyPause): Promise<undefined> {
		await this.pauses.paused(pause)
		return undefined
	}
}
