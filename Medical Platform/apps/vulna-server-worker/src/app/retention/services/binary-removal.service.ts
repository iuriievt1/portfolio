import { CONFIGURATION_KEY, type DurableBinaryRemovalPort, observedPort, textValueOf } from "@ansora/core-server"
import { MedplumBinaryStore } from "@ansora/vulna-adapter-clinical-record-medplum"
import { CLINICAL_RECORD_FAILURE_CHECKS } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"

interface ConnectedRemoval {
	baseUrl: string
	clientId: string
	removal: DurableBinaryRemovalPort
}

// CAP-026-R19, dorucovaci-jadro.md 6, datovy-model.md 5, ADR-050 bod 17
@Injectable()
export class BinaryRemovalService {
	private readonly logger = new Logger(BinaryRemovalService.name)
	private connected: ConnectedRemoval | undefined
	private warnedAboutCredential = false

	constructor(
		private readonly configuration: ConfigurationService,
		private readonly env: EnvVariableService,
		private readonly dependencies: DependencyStateService,
	) {}

	async current(): Promise<DurableBinaryRemovalPort | undefined> {
		const baseUrl = textValueOf(await this.configuration.effectiveValues(), CONFIGURATION_KEY.CLINICAL_RECORD_BASE_URL)
		const clientId = this.env.getOptional(EnvVariable.CLINICAL_RECORD_RETENTION_CLIENT_ID)
		const clientSecret = this.env.getOptional(EnvVariable.CLINICAL_RECORD_RETENTION_CLIENT_SECRET)
		if (baseUrl === undefined || clientId === undefined || clientSecret === undefined) {
			this.warnOnceAboutCredential()
			return undefined
		}
		if (this.connected?.baseUrl === baseUrl && this.connected.clientId === clientId) {
			return this.connected.removal
		}
		const removal = observedPort<DurableBinaryRemovalPort>(
			new MedplumBinaryStore({ baseUrl, clientId, clientSecret }),
			this.dependencies.clinicalRecordStore,
			CLINICAL_RECORD_FAILURE_CHECKS,
		)
		this.connected = { baseUrl, clientId, removal }
		return removal
	}

	private warnOnceAboutCredential(): void {
		if (this.warnedAboutCredential) {
			return
		}
		this.warnedAboutCredential = true
		this.logger.warn("Retention in the clinical record waits: the store address or the retention credential is missing")
	}
}
