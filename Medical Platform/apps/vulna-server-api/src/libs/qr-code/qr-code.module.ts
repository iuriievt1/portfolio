import { Module } from "@nestjs/common"
import { QrCodeKeyService } from "./qr-code-key.service"

@Module({
	providers: [QrCodeKeyService],
	exports: [QrCodeKeyService],
})
export class QrCodeModule {}
