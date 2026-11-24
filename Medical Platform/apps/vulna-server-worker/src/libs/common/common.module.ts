import { Global, Module } from "@nestjs/common"
import { EnvVariableService } from "./services/env-variable.service"

/** Shared services of the process. Holds no domain logic — that lives in `@ansora/vulna-domain`. */
@Global()
@Module({
	providers: [EnvVariableService],
	exports: [EnvVariableService],
})
export class CommonModule {}
