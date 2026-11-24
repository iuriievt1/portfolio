// CAP-022-R03, NAB-198
export const RECOGNITION_LANGUAGES = ["ces", "eng"] as const
export const MODEL_FILE_SUFFIX = ".traineddata"

// ADR-018, ADR-005 ř. 38
export const TESSERACT_PATH = "/usr/local/bin/tesseract"
export const TESSDATA_PATH = "/usr/share/tesseract-ocr/5/tessdata"

// ADR-005, backend.md 5
export const SANDBOX_PATH = "/usr/local/bin/ocr-sandbox"
export const SYSTEM_LIBRARY_PATH = "/usr/lib"
export const SANDBOX_OPTION = {
	READ: "--read",
	EXECUTE: "--execute",
	WRITE: "--write",
} as const
export const SANDBOX_SEPARATOR = "--"
export const ISOLATION_FAILED_EXIT = 125
export const START_FAILED_EXIT = 127

// ADR-018, backend.md 5
export const ATTEMPT_DIRECTORY_PREFIX = "vulna-ocr-"
export const PAGE_LIST_FILE = "pages.txt"
export const PAGE_FILE_PREFIX = "page-"
export const PAGE_FILE_SUFFIX = ".jpg"
export const OUTPUT_BASE = "document"
export const OUTPUT_FILE = `${OUTPUT_BASE}.pdf`
export const NEW_FILE_FLAG = "wx"
export const PRIVATE_FILE_MODE = 0o600
export const LINE_BREAK = "\n"

// backend.md 5, NAB-465
export const SUBPROCESS_ENVIRONMENT: Readonly<Record<string, string>> = {}

// CAP-022-R02
export const KILL_SIGNAL = "SIGKILL"
export const MEMORY_CHECK_INTERVAL_MILLISECONDS = 100
export const PROCESS_STATUS_PLATFORM = "linux"

// CAP-022-R10
export const SUCCESSFUL_EXIT = 0
export const STDERR_TAIL_BYTES = 2048

// CAP-022-R10, ADR-018
export const TEXT_RECOGNITION_FAILURE = {
	MODELS_MISSING: "models_missing",
	INVALID_PAGE: "invalid_page",
	START_FAILED: "start_failed",
	ISOLATION_FAILED: "isolation_failed",
	TIMED_OUT: "timed_out",
	MEMORY_EXCEEDED: "memory_exceeded",
	MEMORY_UNWATCHED: "memory_unwatched",
	CRASHED: "crashed",
	INVALID_OUTPUT: "invalid_output",
} as const

// ADR-018, CAP-022-R03, CAP-022-R05, CAP-022-R16
export const TESSDATA_OPTION = "--tessdata-dir"
export const LANGUAGE_OPTION = "-l"
export const LANGUAGE_SEPARATOR = "+"
export const VARIABLE_OPTION = "-c"
export const PDF_OUTPUT_VARIABLE = "tessedit_create_pdf=1"
export const TITLE_VARIABLE = "document_title"
