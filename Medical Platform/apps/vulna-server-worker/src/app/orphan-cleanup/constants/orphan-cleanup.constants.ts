// CAP-026-R14, dorucovaci-jadro.md 2
export const ORPHAN_CLEANUP_PERIOD_MILLISECONDS = 3_600_000
export const ORPHAN_CLEANUP_BATCH_SIZE = 500

// datovy-model.md 4 „Binární objekt“
export const BINARY_OBJECT_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// CAP-026-R14, datovy-model.md 4 „Binární objekt“
export const BINARY_OBJECT_REFERENCES = [
	{ table: "image", column: "binary_object_id" },
	{ table: "image", column: "viewing_copy_binary_object_id" },
	{ table: "thumbnail", column: "binary_object_id" },
	{ table: "document_page", column: "binary_object_id" },
	{ table: "document_page", column: "thumbnail_binary_object_id" },
	{ table: "document_page", column: "viewing_copy_binary_object_id" },
	{ table: "document", column: "output_pdf_binary_object_id" },
	{ table: "artifact_variant", column: "binary_object_id" },
] as const
