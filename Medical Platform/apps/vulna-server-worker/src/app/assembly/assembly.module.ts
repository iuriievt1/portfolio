import { Module } from "@nestjs/common"
import { DependencyStateModule } from "../../libs/dependency-state/dependency-state.module"
import { PacsModule } from "../../libs/pacs/pacs.module"
import { TextRecognitionModule } from "../text-recognition/text-recognition.module"
import { AssemblyAlertRepository } from "./repositories/assembly-alert.repository"
import { AssemblyRecordRepository } from "./repositories/assembly-record.repository"
import { AssemblyResultRepository } from "./repositories/assembly-result.repository"
import { CodeListNameRepository } from "./repositories/code-list-name.repository"
import { AssemblerService } from "./services/assembler.service"
import { AssemblyService } from "./services/assembly.service"
import { AssemblyPauseService } from "./services/assembly-pause.service"
import { AssemblySettingsService } from "./services/assembly-settings.service"
import { ClosedRecordReaderService } from "./services/closed-record-reader.service"

// CAP-021-R04, CAP-022, ADR-054 bod 4, dorucovaci-jadro.md 3, 4
@Module({
	imports: [DependencyStateModule, PacsModule, TextRecognitionModule],
	providers: [
		AssemblyRecordRepository,
		AssemblyResultRepository,
		AssemblyAlertRepository,
		CodeListNameRepository,
		ClosedRecordReaderService,
		AssemblyPauseService,
		AssemblySettingsService,
		AssemblerService,
		AssemblyService,
	],
})
export class AssemblyModule {}
