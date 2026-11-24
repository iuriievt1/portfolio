import type { IntegritySignal } from "@ansora/contracts"
import cs from "@/i18n/cs.json"
import { formatList } from "@/lib/format"

const SIGNAL_LABEL: Readonly<Record<IntegritySignal, string>> = cs.devices.signal

// CAP-008-R02, CAP-008-S09
export function signalsText(signals: readonly IntegritySignal[]): string {
	return formatList(signals.map((signal) => SIGNAL_LABEL[signal]))
}
