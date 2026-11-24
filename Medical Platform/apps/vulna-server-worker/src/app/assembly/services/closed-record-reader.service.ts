import { CONFIGURATION_KEY, type ConfigurationValues, observedPort, textValueOf } from "@ansora/core-server"
import { DEFAULT_CANONICAL_BASE, MedplumClosedRecordReader } from "@ansora/vulna-adapter-clinical-record-medplum"
import { CLINICAL_RECORD_FAILURE_CHECKS, type ClosedRecordReaderPort } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import type { ConnectedReader, ReaderConnection } from "../types/assembly.types"

function isSameConnection(left: ReaderConnection, right: ReaderConnection): boolean {
	return (
		left.baseUrl === right.baseUrl &&
		left.instanceBaseUri === right.instanceBaseUri &&
		left.canonicalBase === right.canonicalBase &&
		left.clientId === right.clientId
	)
}

// ADR-054 bod 4, CAP-012-R30, architektura.md 3
@Injectable()
export class ClosedRecordReaderService {
	private connected: ConnectedReader | undefined

	constructor(
		private readonly env: EnvVariableService,
		private readonly dependencies: DependencyStateService,
	) {}

	current(values: ConfigurationValues): ClosedRecordReaderPort | undefined {
		const baseUrl = textValueOf(values, CONFIGURATION_KEY.CLINICAL_RECORD_BASE_URL)
		const instanceBaseUri = textValueOf(values, CONFIGURATION_KEY.CLINICAL_RECORD_INSTANCE_BASE_URI)
		const clientId = this.env.getOptional(EnvVariable.CLINICAL_RECORD_WORKER_CLIENT_ID)
		const clientSecret = this.env.getOptional(EnvVariable.CLINICAL_RECORD_WORKER_CLIENT_SECRET)
		if (
			baseUrl === undefined ||
			instanceBaseUri === undefined ||
			clientId === undefined ||
			clientSecret === undefined
		) {
			return undefined
		}
		const canonicalBase = this.env.getOptional(EnvVariable.CLINICAL_RECORD_CANONICAL_BASE) ?? DEFAULT_CANONICAL_BASE
		const connection = { baseUrl, instanceBaseUri, canonicalBase, clientId }
		if (this.connected !== undefined && isSameConnection(this.connected, connection)) {
			return this.connected.reader
		}
		const reader = observedPort<ClosedRecordReaderPort>(
			new MedplumClosedRecordReader({ ...connection, clientSecret }),
			this.dependencies.clinicalRecordStore,
			CLINICAL_RECORD_FAILURE_CHECKS,
		)
		this.connected = { ...connection, reader }
		return reader
	}
}
