import { newQrCodeIdentifier, type ParsedQrCode, QrCodeKeyRing } from "@ansora/core-server"
import { Injectable, Logger } from "@nestjs/common"
import { EnvVariable } from "../common/constants/env-variable.constants"
import { EnvVariableService } from "../common/services/env-variable.service"
import { readStoredKeys } from "../hpke/utils/stored-keys"
import type { SignedQrCode } from "./types/qr-code.types"

@Injectable()
export class QrCodeKeyService {
	private readonly ring: QrCodeKeyRing | undefined
	private readonly logger = new Logger(QrCodeKeyService.name)

	constructor(env: EnvVariableService) {
		const directory = env.getOptional(EnvVariable.QR_SIGNING_KEYS_PATH)
		const current = env.getOptional(EnvVariable.QR_SIGNING_CURRENT_KEY_VERSION)
		if (directory === undefined || current === undefined) {
			this.ring = undefined
			this.logger.warn("No QR signing keys configured; personal QR codes cannot be verified")
			return
		}
		const stored = readStoredKeys(directory).map((key) => ({ version: Number(key.version), pem: key.pem }))
		this.ring = QrCodeKeyRing.fromPem(stored, Number(current))
		this.logger.log(`QR signing key versions ${this.ring.versions.join(", ")}; current ${current}`)
	}

	issue(): SignedQrCode {
		if (this.ring === undefined) {
			throw new Error("No QR signing keys configured; personal QR codes cannot be issued")
		}
		const identifier = newQrCodeIdentifier()
		return { identifier, keyVersion: this.ring.currentVersion, content: this.ring.issue(identifier) }
	}

	verify(code: ParsedQrCode): boolean {
		return this.ring?.verify(code) ?? false
	}
}
