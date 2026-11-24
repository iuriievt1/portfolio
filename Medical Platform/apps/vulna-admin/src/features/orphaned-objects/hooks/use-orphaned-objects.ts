import { useCallback } from "react"
import { callApi, withQuery } from "@/api/client"
import type {
	OrphanedObject,
	OrphanedObjectDeletion,
	OrphanedObjectsPage,
} from "@/features/orphaned-objects/types/orphaned-object.types"
import { type CursorList, useCursorList } from "@/lib/use-cursor-list"

const ORPHANED_OBJECTS_PATH = "/orphaned-objects"

// CAP-026-R14, CAP-026-S07, administration.yaml listOrphanedObjects
export function useOrphanedObjects(): CursorList<OrphanedObject> {
	const loadPage = useCallback(
		(cursor: string | undefined, init?: RequestInit) =>
			callApi<OrphanedObjectsPage>(withQuery(ORPHANED_OBJECTS_PATH, { cursor }), init),
		[],
	)
	return useCursorList(loadPage)
}

// CAP-026-S08, administration.yaml deleteOrphanedObject
export function deleteOrphanedObject(objectId: string, deletion: OrphanedObjectDeletion): Promise<void> {
	return callApi<void>(`${ORPHANED_OBJECTS_PATH}/${encodeURIComponent(objectId)}/deletion`, {
		method: "POST",
		body: JSON.stringify(deletion),
	})
}
