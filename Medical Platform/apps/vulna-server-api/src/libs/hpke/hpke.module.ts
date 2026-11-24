import { Module } from "@nestjs/common"
import { HpkeKeyService } from "./hpke-key.service"

@Module({
	providers: [HpkeKeyService],
	exports: [HpkeKeyService],
})
export class HpkeModule {}
