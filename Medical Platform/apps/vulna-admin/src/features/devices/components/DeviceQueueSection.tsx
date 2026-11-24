import { DetailFields } from "@/components/custom/detail-fields"
import { PageSection } from "@/components/custom/page-section"
import { queueFieldsOf } from "@/features/devices/lib/device-queue"
import type { Device } from "@/features/devices/types/device.types"
import cs from "@/i18n/cs.json"

const texts = cs.devices.queue

// CAP-019-R08, CAP-007-R10, CAP-007-S08, DESIGN.md 8.8
export function DeviceQueueSection({ queue }: { queue: Device["queue"] }) {
	return (
		<PageSection title={texts.heading} description={texts.description}>
			{queue === null ? (
				<p className="text-sm text-muted-foreground">{texts.unknown}</p>
			) : (
				<DetailFields fields={queueFieldsOf(queue)} />
			)}
		</PageSection>
	)
}
