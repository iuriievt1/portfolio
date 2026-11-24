import { DEPENDENCY_STATE, type DependencyState, MONITORED_DEPENDENCY } from "@ansora/contracts"
import {
	answeredWithin,
	databaseAnswers,
	dependencyStateFamily,
	openMetricsText,
	type SurveillanceAccess,
	surveillanceAccessOf,
	surveillanceTokenOf,
} from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import { DatabaseService } from "../../../libs/database/database.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import { DurableBinaryStoreService } from "../../clinical-record-upload/services/durable-binary-store.service"
import type { WorkerDependency } from "../types/surveillance.types"

// CAP-028-R05, CAP-028-R06, CAP-028-R08, CAP-028-R20
@Injectable()
export class SurveillanceService {
	private readonly token: string | undefined

	constructor(
		env: EnvVariableService,
		private readonly database: DatabaseService,
		private readonly dependencies: DependencyStateService,
		private readonly stores: DurableBinaryStoreService,
	) {
		this.token = surveillanceTokenOf(env.getOptional(EnvVariable.SURVEILLANCE_TOKEN))
	}

	// provoz-a-dohled.md 7.2
	accessOf(authorization: string | undefined): SurveillanceAccess {
		return surveillanceAccessOf({ authorization, isReservedInterface: true }, this.token)
	}

	async isReady(): Promise<boolean> {
		return await databaseAnswers(this.database.sql)
	}

	async dependencyStates(): Promise<Record<WorkerDependency, DependencyState>> {
		const isDatabaseReady = await this.isReady()
		return {
			[MONITORED_DEPENDENCY.DATABASE]: isDatabaseReady ? DEPENDENCY_STATE.AVAILABLE : DEPENDENCY_STATE.UNAVAILABLE,
			[MONITORED_DEPENDENCY.CLINICAL_RECORD_STORE]: await this.storeState(isDatabaseReady),
		}
	}

	// CAP-028-R09, CAP-028-R10, CAP-028-S01
	async metricsText(): Promise<string> {
		return openMetricsText([dependencyStateFamily(await this.dependencyStates())])
	}

	// CAP-028-R21
	private async storeState(isDatabaseReady: boolean): Promise<DependencyState> {
		if (isDatabaseReady && (await answeredWithin(this.isStoreUnconfigured())) === true) {
			return DEPENDENCY_STATE.UNAVAILABLE
		}
		return this.dependencies.clinicalRecordStore.state()
	}

	private async isStoreUnconfigured(): Promise<boolean> {
		return (await this.stores.current()) === undefined
	}
}
