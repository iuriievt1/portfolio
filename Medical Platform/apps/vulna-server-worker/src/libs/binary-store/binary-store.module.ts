import { LocalBinaryStore } from "@ansora/vulna-adapter-binary-local"
import { Global, Logger, Module } from "@nestjs/common"
import { EnvVariable } from "../common/constants/env-variable.constants"
import { EnvVariableService } from "../common/services/env-variable.service"
import { BINARY_STORE } from "./binary-store.constants"
import type { BufferStore } from "./binary-store.types"

// ADR-003, NAB-022, CAP-021-R35, CAP-026-R14
function localBinaryStoreOf(env: EnvVariableService): BufferStore {
	const rootDirectory = env.get(EnvVariable.BINARY_STORE_PATH)
	new Logger("BinaryStore").log(`Binary store root ${rootDirectory}`)
	return new LocalBinaryStore(rootDirectory)
}

@Global()
@Module({
	providers: [{ provide: BINARY_STORE, useFactory: localBinaryStoreOf, inject: [EnvVariableService] }],
	exports: [BINARY_STORE],
})
export class BinaryStoreModule {}
