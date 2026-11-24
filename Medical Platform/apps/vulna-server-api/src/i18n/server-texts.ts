import type { ErrorCode } from "@ansora/contracts"

export interface ServerTexts {
	language: string
	problem: { rejected: string; serverError: string }
	problems: Readonly<Record<ErrorCode, string>>
	loginReturn: { notAccepted: string }
}
