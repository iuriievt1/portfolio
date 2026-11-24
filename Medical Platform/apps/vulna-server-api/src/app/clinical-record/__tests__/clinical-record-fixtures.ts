import type { ClinicalRecordStorePort } from "@ansora/vulna-domain"
import type { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { ClinicalRecordStoreService } from "../services/clinical-record-store.service"

export function storesWith(
	store: Partial<ClinicalRecordStorePort> | undefined,
	dependencies = new DependencyStateService(),
): ClinicalRecordStoreService {
	const stores = new ClinicalRecordStoreService({} as ConfigurationService, {} as EnvVariableService, dependencies)
	stores.current = async () => store as ClinicalRecordStorePort | undefined
	return stores
}
