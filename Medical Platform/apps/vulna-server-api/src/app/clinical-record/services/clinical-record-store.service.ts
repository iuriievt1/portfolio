import { UNVERSIONED_RELEASE } from "@ansora/contracts"
import { CONFIGURATION_KEY, type DurableBinaryLinkPort, observedPort, textValueOf } from "@ansora/core-server"
import {
	DEFAULT_CANONICAL_BASE,
	MedplumBinaryStore,
	MedplumClinicalRecordStore,
	MedplumImageHistory,
	type StorageSigning,
} from "@ansora/vulna-adapter-clinical-record-medplum"
import {
	CLINICAL_RECORD_FAILURE_CHECKS,
	type ClinicalRecordStorePort,
	type ImageHistoryPort,
	isClinicalRecordRejection,
	isClinicalRecordUnavailability,
} from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { DocumentationUnavailableException } from "../exceptions/documentation-unavailable.exception"
import type { ConnectedStore, StoreConnection } from "../types/clinical-record.types"

function sameConnection(current: StoreConnection, wanted: StoreConnection): boolean {
	return (
		current.baseUrl === wanted.baseUrl &&
		current.instanceBaseUri === wanted.instanceBaseUri &&
		current.clientId === wanted.clientId &&
		current.storageUrl === wanted.storageUrl
	)
}

// ADR-054 bod 3, CAP-012-R30
@Injectable()
export class ClinicalRecordStoreService {
	private readonly logger = new Logger(ClinicalRecordStoreService.name)
	private connected: ConnectedStore | undefined

	constructor(
		private readonly configuration: ConfigurationService,
		private readonly env: EnvVariableService,
		private readonly dependencies: DependencyStateService,
	) {}

	async current(): Promise<ClinicalRecordStorePort | undefined> {
		return (await this.connection())?.store
	}

	// ADR-054 bod 2, CAP-020-R03
	async history(): Promise<ImageHistoryPort | undefined> {
		return (await this.connection())?.history
	}

	// ADR-053 (doplnění 2026-09-24) bod 1, CAP-020-R22
	async links(): Promise<DurableBinaryLinkPort | undefined> {
		return (await this.connection())?.links
	}

	private async connection(): Promise<ConnectedStore | undefined> {
		const { values } = await this.configuration.effective()
		const baseUrl = textValueOf(values, CONFIGURATION_KEY.CLINICAL_RECORD_BASE_URL)
		const instanceBaseUri = textValueOf(values, CONFIGURATION_KEY.CLINICAL_RECORD_INSTANCE_BASE_URI)
		const clientId = this.env.getOptional(EnvVariable.CLINICAL_RECORD_CLIENT_ID)
		const clientSecret = this.env.getOptional(EnvVariable.CLINICAL_RECORD_CLIENT_SECRET)
		if (
			baseUrl === undefined ||
			instanceBaseUri === undefined ||
			clientId === undefined ||
			clientSecret === undefined
		) {
			return undefined
		}
		// konfigurace-a-profily.md 2.1
		const connection = {
			baseUrl,
			instanceBaseUri,
			clientId,
			storageUrl: textValueOf(values, CONFIGURATION_KEY.CLINICAL_RECORD_STORAGE_URL),
		}
		if (this.connected !== undefined && sameConnection(this.connected, connection)) {
			return this.connected
		}
		const canonicalBase = this.env.getOptional(EnvVariable.CLINICAL_RECORD_CANONICAL_BASE) ?? DEFAULT_CANONICAL_BASE
		const observation = this.dependencies.clinicalRecordStore
		const store = new MedplumClinicalRecordStore({
			baseUrl,
			clientId,
			clientSecret,
			canonicalBase,
			instanceBaseUri,
			serverVersion: this.env.getOptional(EnvVariable.SERVER_VERSION) ?? UNVERSIONED_RELEASE,
		})
		const history = new MedplumImageHistory({ baseUrl, clientId, clientSecret, canonicalBase, instanceBaseUri })
		this.connected = {
			...connection,
			store: observedPort<ClinicalRecordStorePort>(store, observation, CLINICAL_RECORD_FAILURE_CHECKS),
			history: observedPort<ImageHistoryPort>(history, observation, CLINICAL_RECORD_FAILURE_CHECKS),
			links: new MedplumBinaryStore({
				baseUrl,
				clientId,
				clientSecret,
				storageSigning: this.storageSigningOf(connection.storageUrl),
			}),
		}
		return this.connected
	}

	// ADR-053 (doplnění 2026-09-24) bod 1, CAP-012-R30
	private storageSigningOf(storageUrl: string | undefined): StorageSigning | undefined {
		const signingKey = this.env.getOptional(EnvVariable.CLINICAL_RECORD_STORAGE_SIGNING_KEY)
		const signingKeyPassphrase = this.env.getOptional(EnvVariable.CLINICAL_RECORD_STORAGE_SIGNING_KEY_PASSPHRASE)
		if (storageUrl === undefined || signingKey === undefined || signingKeyPassphrase === undefined) {
			return undefined
		}
		return { storageUrl, signingKey, signingKeyPassphrase }
	}

	// ADR-054 bod 5
	async requireStore(subject: string): Promise<ClinicalRecordStorePort> {
		const store = await this.current()
		if (store === undefined) {
			this.logger.error(`The ${subject} cannot be recorded: the clinical record store is not configured`)
			this.dependencies.clinicalRecordStore.recordRejectedRequest(Date.now())
			throw new DocumentationUnavailableException()
		}
		return store
	}

	// ADR-054
	async written<T>(subject: string, write: () => Promise<T>): Promise<T> {
		try {
			return await write()
		} catch (error) {
			throw this.unavailableProblem(subject, error)
		}
	}

	// ADR-054 bod 5
	unavailableProblem(subject: string, error: unknown): DocumentationUnavailableException {
		this.reportFailure(subject, error)
		// CAP-028-R22
		if (isClinicalRecordUnavailability(error)) {
			this.dependencies.clinicalRecordStore.recordRejectedRequest(Date.now())
		}
		return new DocumentationUnavailableException()
	}

	// ADR-054 bod 5
	reportFailure(subject: string, error: unknown): void {
		const message = error instanceof Error ? error.message : String(error)
		if (isClinicalRecordRejection(error)) {
			this.logger.error(`The store rejected the ${subject}: ${message}`)
		} else {
			this.logger.warn(`The store is unavailable for the ${subject}: ${message}`)
		}
	}
}
