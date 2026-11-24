import { CaretDownIcon } from "@phosphor-icons/react"
import { cn } from "cn"
import { DetailFields } from "@/components/custom/detail-fields"
import { PageSection } from "@/components/custom/page-section"
import { RowLink } from "@/components/custom/row-link"
import { Card } from "@/components/ui/card"
import {
	clinicalRecordStoreFieldsOf,
	deliveryQueueFieldsOf,
	deviceFieldsOf,
	imageDataFieldsOf,
} from "@/features/alerts/lib/metrics-view"
import type { OperationalMetrics } from "@/features/alerts/types/alert.types"
import cs from "@/i18n/cs.json"
import { REVEAL } from "@/lib/motion"
import { deliveriesPagePath } from "@/lib/routes"

const texts = cs.alerts.metrics

// CAP-028-R14, CAP-028-R22, DESIGN.md 2
export function OperationalDetailsCard({ metrics }: { metrics: OperationalMetrics }) {
	return (
		<Card className="gap-0 py-0">
			<details className="group">
				<summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-(--card-p) py-3 text-sm font-semibold transition-colors outline-hidden hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
					{texts.details}
					<CaretDownIcon
						aria-hidden
						className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
					/>
				</summary>
				<div className={cn("grid divide-y border-t xl:grid-cols-4 xl:divide-x xl:divide-y-0", REVEAL)}>
					<PageSection title={texts.clinicalRecordStore.heading}>
						<DetailFields fields={clinicalRecordStoreFieldsOf(metrics)} />
					</PageSection>
					<PageSection title={texts.imageData.heading}>
						<DetailFields fields={imageDataFieldsOf(metrics)} />
					</PageSection>
					<PageSection
						title={cs.deliveries.heading}
						action={<RowLink to={deliveriesPagePath()}>{cs.alerts.openDeliveries}</RowLink>}
					>
						<DetailFields fields={deliveryQueueFieldsOf(metrics)} />
					</PageSection>
					<PageSection title={texts.devices.heading}>
						<DetailFields fields={deviceFieldsOf(metrics)} />
					</PageSection>
				</div>
			</details>
		</Card>
	)
}
