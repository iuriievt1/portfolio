import { z } from "zod"

// clinical-workflow.yaml ImageId, PageId
export const fileIdSchema = z.uuid()
