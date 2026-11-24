import { Module } from "@nestjs/common"
import { DependencyStateService } from "./dependency-state.service"

// CAP-028-R05, CAP-028-R20
@Module({
	providers: [DependencyStateService],
	exports: [DependencyStateService],
})
export class DependencyStateModule {}
