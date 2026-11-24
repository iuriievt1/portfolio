import { Module } from "@nestjs/common"
import { EnvVariableService } from "../../libs/common/services/env-variable.service"
import { BINARY_STORE } from "./constants/binary-object.constants"
import { BinaryObjectRepository } from "./repositories/binary-object.repository"
import { BinaryObjectService } from "./services/binary-object.service"
import { localBinaryStoreOf } from "./utils/local-binary-store"

// ADR-003, CAP-021-R35
@Module({
	providers: [
		{ provide: BINARY_STORE, useFactory: localBinaryStoreOf, inject: [EnvVariableService] },
		BinaryObjectRepository,
		BinaryObjectService,
	],
	exports: [BinaryObjectService],
})
export class BinaryObjectModule {}
