import { Module } from "@nestjs/common"
import { DocumentPdfRepository } from "./repositories/document-pdf.repository"
import { PdfUploadTaskRepository } from "./repositories/pdf-upload-task.repository"
import { DocumentPdfService } from "./services/document-pdf.service"
import { TesseractService } from "./services/tesseract.service"

// CAP-022, ADR-018, backend.md 5
@Module({
	providers: [DocumentPdfRepository, PdfUploadTaskRepository, TesseractService, DocumentPdfService],
	exports: [DocumentPdfService, DocumentPdfRepository],
})
export class TextRecognitionModule {}
