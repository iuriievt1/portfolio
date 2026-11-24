import { DetailFields } from "@/components/custom/detail-fields"
import { PageSection } from "@/components/custom/page-section"
import { RevokeAction } from "@/components/custom/revoke-action"
import { BLOCKED, PENDING_APPROVAL, REVOKED } from "@/features/devices/constants/device-state"
import { revokeDevice } from "@/features/devices/hooks/use-devices"
import { deviceName } from "@/features/devices/lib/device-label"
import { queueFieldsOf } from "@/features/devices/lib/device-queue"
import type { Device } from "@/features/devices/types/device.types"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"
import { REVOKE_DIALOG_TEXTS } from "@/lib/revoke-dialog-texts"

const texts = cs.devices.revocation

interface Props {
	device: Device
	onRevoked: () => void
}

// CAP-007-R02, CAP-007-R06, CAP-007-R10, CAP-006-R20, procesy-a-stavy.md 2.1
export function DeviceRevocationSection({ device, onRevoked }: Props) {
	if (device.state === BLOCKED) {
		return null
	}
	if (device.state === REVOKED) {
		return (
			<PageSection title={texts.heading}>
				<p className="text-sm text-muted-foreground">{texts.revoked}</p>
			</PageSection>
		)
	}
	const isPending = device.state === PENDING_APPROVAL
	return (
		<PageSection
			title={texts.heading}
			action={
				<RevokeAction
					{...REVOKE_DIALOG_TEXTS}
					label={texts.action}
					accessibleLabel={undefined}
					heading={isPending ? texts.rejectHeading : fillText(texts.confirmHeading, { name: deviceName(device) })}
					body={isPending ? texts.rejectBody : texts.confirmBody}
					revoke={() => revokeDevice(device.id)}
					onRevoked={onRevoked}
				>
					{isPending ? null : <UnsentQueue queue={device.queue} />}
				</RevokeAction>
			}
		>
			<p className="text-sm text-muted-foreground">{isPending ? texts.pendingDescription : texts.description}</p>
		</PageSection>
	)
}

// CAP-007-S03, CAP-007-S08
function UnsentQueue({ queue }: { queue: Device["queue"] }) {
	if (queue === null) {
		return <p className="text-sm text-muted-foreground">{cs.devices.queue.unknown}</p>
	}
	return <DetailFields fields={queueFieldsOf(queue)} />
}
