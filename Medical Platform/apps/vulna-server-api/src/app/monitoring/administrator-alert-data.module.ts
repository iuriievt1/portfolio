import { Module } from "@nestjs/common"
import { AdministratorAlertRepository } from "./repositories/administrator-alert.repository"

// CAP-028-R15
@Module({
	providers: [AdministratorAlertRepository],
	exports: [AdministratorAlertRepository],
})
export class AdministratorAlertDataModule {}
