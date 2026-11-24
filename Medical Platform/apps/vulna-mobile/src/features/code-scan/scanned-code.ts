type Delivery = (content: string | undefined) => void

let pending: Delivery | undefined

export function awaitScannedCode(): Promise<string | undefined> {
	finishCodeScan(undefined)
	return new Promise((resolve) => {
		pending = resolve
	})
}

export function finishCodeScan(content: string | undefined): void {
	const deliver = pending
	pending = undefined
	deliver?.(content)
}
