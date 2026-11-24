import type { AssemblyFailureReason } from "../types/assembly.types"

// CAP-022-R11, datovy-model.md 4 „Doručení“
export class AssemblyFailure extends Error {
	constructor(
		readonly reason: AssemblyFailureReason,
		message: string,
	) {
		super(message)
		this.name = "AssemblyFailure"
	}
}
