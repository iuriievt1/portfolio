const PEAK_RESIDENT_LINE = /^VmHWM:\s+(\d+)\s+kB$/m
const BYTES_PER_KILOBYTE = 1024

// CAP-022-R02
export function processStatusPathOf(pid: number): string {
	return `/proc/${pid}/status`
}

// CAP-022-R02
export function peakResidentBytesOf(status: string): number | undefined {
	const kilobytes = PEAK_RESIDENT_LINE.exec(status)?.[1]
	return kilobytes === undefined ? undefined : Number(kilobytes) * BYTES_PER_KILOBYTE
}
