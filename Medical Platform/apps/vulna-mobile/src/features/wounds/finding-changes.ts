let changes = 0

// CAP-020-R19, CAP-020-R21
export function noteFindingChange(): void {
	changes += 1
}

export function findingChangeCount(): number {
	return changes
}
