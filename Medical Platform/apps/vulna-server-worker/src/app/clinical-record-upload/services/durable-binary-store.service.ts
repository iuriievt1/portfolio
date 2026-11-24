import { CONFIGURATION_KEY, type DurableBinaryStorePort, observedPort, textValueOf } from "@ansora/core-server"
import { MedplumBinaryStore } from "@ansora/vulna-adapter-clinical-record-medplum"
import { CLINICAL_RECORD_FAILURE_CHECKS } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import type { ConnectedStore } from "../types/clinical-record-upload.types"

// CAP-021-R36, CAP-012-R30, architektura.md 3
@Injectable()
export class DurableBinaryStoreService {
	private readonly logger = new Logger(DurableBinaryStoreService.name)
	private connected: ConnectedStore | undefined
	private warnedAboutStore = false

	constructor(
		private readonly configuration: ConfigurationService,
		private readonly env: EnvVariableService,
		private readonly dependencies: DependencyStateService,
	) {}

	async current(): Promise<DurableBinaryStorePort | undefined> {
		const baseUrl = textValueOf(await this.configuration.effectiveValues(), CONFIGURATION_KEY.CLINICAL_RECORD_BASE_URL)
		const clientId = this.env.getOptional(EnvVariable.CLINICAL_RECORD_WORKER_CLIENT_ID)
		const clientSecret = this.env.getOptional(EnvVariable.CLINICAL_RECORD_WORKER_CLIENT_SECRET)
		if (baseUrl === undefined || clientId === undefined || clientSecret === undefined) {
			this.warnOnceAboutStore()
			return undefined
		}
		if (this.connected?.baseUrl === baseUrl && this.connected.clientId === clientId) {
			return this.connected.store
		}
		const store = observedPort<DurableBinaryStorePort>(
			new MedplumBinaryStore({ baseUrl, clientId, clientSecret }),
			this.dependencies.clinicalRecordStore,
			CLINICAL_RECORD_FAILURE_CHECKS,
		)
		this.connected = { baseUrl, clientId, store }
		return store
	}

	private warnOnceAboutStore(): void {
		if (this.warnedAboutStore) {
			return
		}
		this.warnedAboutStore = true
		this.logger.warn("Uploads wait: the clinical record store address or the worker credential is not configured")
	}
}
