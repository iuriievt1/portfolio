import { Module } from "@nestjs/common"
import { CodeListRepository } from "./repositories/code-list.repository"
import { CodeListSetRepository } from "./repositories/code-list-set.repository"

// CAP-017-R05, CAP-012-R28
@Module({
	providers: [CodeListRepository, CodeListSetRepository],
	exports: [CodeListRepository, CodeListSetRepository],
})
export class CodeListDataModule {}
