// ADR-014, CAP-019-R32
export const UPLOAD_STAGE = {
	ANNOUNCEMENT: "announcement",
	UPLOAD: "upload",
} as const

export type UploadStage = (typeof UPLOAD_STAGE)[keyof typeof UPLOAD_STAGE]
