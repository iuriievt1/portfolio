import { UNVERSIONED_RELEASE } from "@ansora/contracts"
import { type ImplementationIdentity, isImplementationVersionName } from "@ansora/vulna-projection-dicom"
import { Injectable, Logger } from "@nestjs/common"
import { EnvVariable } from "../common/constants/env-variable.constants"
import { EnvVariableService } from "../common/services/env-variable.service"

// CAP-012-R17, integrace-dicom.md 4, 5.0, 5.7
@Injectable()
export class ImplementationIdentityService {
	private readonly logger = new Logger(ImplementationIdentityService.name)
	private readonly notices = new Set<string>()

	constructor(private readonly env: EnvVariableService) {}

	// Dockerfile SERVER_VERSION, integrace-dicom.md 5.0, 5.7
	release(): string {
		return this.env.getOptional(EnvVariable.SERVER_VERSION) ?? UNVERSIONED_RELEASE
	}

	identityOf(implementationClassUid: string): ImplementationIdentity {
		return { implementationClassUid, implementationVersionName: this.versionNameOf(this.release()) }
	}

	// DICOM PS3.10 7.1, PS3.8 D.3.3.2.2, integrace-dicom.md 5.0
	private versionNameOf(release: string): string | undefined {
		if (isImplementationVersionName(release)) {
			return release
		}
		if (!this.notices.has(release)) {
			this.notices.add(release)
			this.logger.warn(`The release ${release} does not fit Implementation Version Name; DICOM goes without it`)
		}
		return undefined
	}
}
