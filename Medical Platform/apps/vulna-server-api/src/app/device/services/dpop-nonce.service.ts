import { DpopNonceRing } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"

// ADR-005
@Injectable()
export class DpopNonceService {
	private readonly ring = new DpopNonceRing(new Date())

	current(): string {
		return this.ring.currentNonce(new Date())
	}

	accepts(nonce: string | undefined): boolean {
		return this.ring.accepts(nonce, new Date())
	}
}
