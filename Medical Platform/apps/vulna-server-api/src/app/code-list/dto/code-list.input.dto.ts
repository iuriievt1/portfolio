import { CODE_LIST_SET_VERSION_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import { BODY_DIAGRAM_VERSION_MAX_LENGTH } from "../constants/code-list.constants"

// clinical-workflow.yaml syncCodeLists
export const codeListSyncSchema = z.strictObject({
	known_version: z.string().trim().min(1).max(CODE_LIST_SET_VERSION_MAX_LENGTH).optional(),
})

export type CodeListSyncInput = z.infer<typeof codeListSyncSchema>

// clinical-workflow.yaml getBodyDiagramBackground
export const bodyDiagramVersionSchema = z.string().trim().min(1).max(BODY_DIAGRAM_VERSION_MAX_LENGTH)
