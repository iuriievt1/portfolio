import {
	LANGUAGE_OPTION,
	LANGUAGE_SEPARATOR,
	LINE_BREAK,
	OUTPUT_BASE,
	PAGE_FILE_PREFIX,
	PAGE_FILE_SUFFIX,
	PAGE_LIST_FILE,
	PDF_OUTPUT_VARIABLE,
	RECOGNITION_LANGUAGES,
	SANDBOX_OPTION,
	SANDBOX_SEPARATOR,
	SYSTEM_LIBRARY_PATH,
	TESSDATA_OPTION,
	TITLE_VARIABLE,
	VARIABLE_OPTION,
} from "../constants/text-recognition.constants"
import type { TextRecognitionSettings } from "../types/text-recognition.types"

// ADR-018, CAP-022-R03, CAP-022-R05, CAP-022-R16
export function tesseractArgumentsOf(title: string, tessdataPath: string): string[] {
	return [
		PAGE_LIST_FILE,
		OUTPUT_BASE,
		TESSDATA_OPTION,
		tessdataPath,
		LANGUAGE_OPTION,
		RECOGNITION_LANGUAGES.join(LANGUAGE_SEPARATOR),
		VARIABLE_OPTION,
		PDF_OUTPUT_VARIABLE,
		VARIABLE_OPTION,
		`${TITLE_VARIABLE}=${title}`,
	]
}

// CAP-021-R25
export function pageFileOf(index: number): string {
	return `${PAGE_FILE_PREFIX}${index + 1}${PAGE_FILE_SUFFIX}`
}

// CAP-022-R05
export function pageListOf(pageCount: number): string {
	return Array.from({ length: pageCount }, (_, index) => `${pageFileOf(index)}${LINE_BREAK}`).join("")
}

// ADR-005, backend.md 5
export function sandboxPolicyOf(attemptDirectory: string, settings: TextRecognitionSettings): string[] {
	return [
		SANDBOX_OPTION.WRITE,
		attemptDirectory,
		SANDBOX_OPTION.READ,
		settings.tessdataPath,
		SANDBOX_OPTION.EXECUTE,
		settings.tesseractPath,
		SANDBOX_OPTION.EXECUTE,
		SYSTEM_LIBRARY_PATH,
	]
}

// ADR-005, ADR-018, backend.md 5
export function sandboxedArgumentsOf(
	attemptDirectory: string,
	title: string,
	settings: TextRecognitionSettings,
): string[] {
	return [
		...sandboxPolicyOf(attemptDirectory, settings),
		SANDBOX_SEPARATOR,
		settings.tesseractPath,
		...tesseractArgumentsOf(title, settings.tessdataPath),
	]
}
