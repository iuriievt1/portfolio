import type { BinaryStorePort } from "@ansora/core-server"
import { LocalBinaryStore } from "@ansora/vulna-adapter-binary-local"
import { Logger } from "@nestjs/common"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import type { EnvVariableService } from "../../../libs/common/services/env-variable.service"

// ADR-003, NAB-022
export function localBinaryStoreOf(env: EnvVariableService): BinaryStorePort {
	const rootDirectory = env.get(EnvVariable.BINARY_STORE_PATH)
	new Logger("BinaryStore").log(`Binary store root ${rootDirectory}`)
	return new LocalBinaryStore(rootDirectory)
}
