import { ADMIN_API_BASE_PATH } from "@ansora/contracts"

// administration.yaml listOrphanedObjects, deleteOrphanedObject
export const ORPHANED_OBJECTS_PATH = `${ADMIN_API_BASE_PATH}/orphaned-objects`
export const ORPHANED_OBJECT_ID_PARAMETER = "orphanedObjectId"
export const ORPHANED_OBJECT_DELETION_SUBPATH = `:${ORPHANED_OBJECT_ID_PARAMETER}/deletion`

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
