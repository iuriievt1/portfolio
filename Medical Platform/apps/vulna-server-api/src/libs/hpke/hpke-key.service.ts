import { type HpkeEnvelope, HpkeKeyRing, type ServerHpkeKey } from "@ansora/core-server"
import { Injectable, Logger } from "@nestjs/common"
import { EnvVariable } from "../common/constants/env-variable.constants"
import { EnvVariableService } from "../common/services/env-variable.service"
import { readStoredKeys } from "./utils/stored-keys"

/**
 * The private keys are a secret of the deployment: PEM files in a directory only the API process
 * reads — never in the profile, the database, a backup, a log or the audit ✓ NAB-465,
 * `docs/spec/backend.md` kap. 2.2. The file stem is the key version; `HPKE_CURRENT_KEY_VERSION`
 * names the one devices get. Without them the process does not start.
 */
@Injectable()
export class HpkeKeyService {
	private readonly ring: HpkeKeyRing

	constructor(env: EnvVariableService) {
		const current = env.get(EnvVariable.HPKE_CURRENT_KEY_VERSION)
		this.ring = HpkeKeyRing.fromPem(readStoredKeys(env.get(EnvVariable.HPKE_KEYS_PATH)), current)
		new Logger(HpkeKeyService.name).log(`Server HPKE key versions ${this.ring.versions.join(", ")}; current ${current}`)
	}

	serverHpkeKey(): ServerHpkeKey {
		return this.ring.serverHpkeKey()
	}

	openEnvelope(envelope: HpkeEnvelope, ciphertext: Buffer): Buffer {
		return this.ring.openEnvelope(envelope, ciphertext)
	}
}
