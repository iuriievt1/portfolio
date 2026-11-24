import { DELIVERY_INSTANCE_STATES, DELIVERY_STATES } from "@ansora/contracts"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { pacsStatusText } from "@/features/acquisitions/lib/acquisition-text"
import { ANY_STATE, deliveryInstanceStateOf, deliveryStateOf } from "@/features/deliveries/lib/delivery-filter"
import { deliveryStateText } from "@/features/deliveries/lib/delivery-text"
import type { DeliveryFilter } from "@/features/deliveries/types/delivery.types"
import cs from "@/i18n/cs.json"

const texts = cs.deliveries.filters

const FIELD_ID = {
	STATE: "delivery-filter-state",
	INSTANCE_STATE: "delivery-filter-instance-state",
} as const

interface Props {
	filter: DeliveryFilter
	onApply: (filter: DeliveryFilter) => void
}

// NAB-345, administration.yaml listDeliveries state, instance_state
export function DeliveryFilters({ filter, onApply }: Props) {
	return (
		<search aria-label={texts.label} className="border-b p-(--card-p)">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={FIELD_ID.STATE} className="label-caps text-xs text-muted-foreground">
						{texts.state}
					</Label>
					<NativeSelect
						id={FIELD_ID.STATE}
						value={filter.state ?? ANY_STATE}
						onChange={(event) => onApply({ ...filter, state: deliveryStateOf(event.target.value) })}
					>
						<option value={ANY_STATE}>{texts.any}</option>
						{DELIVERY_STATES.map((state) => (
							<option key={state} value={state}>
								{deliveryStateText(state)}
							</option>
						))}
					</NativeSelect>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={FIELD_ID.INSTANCE_STATE} className="label-caps text-xs text-muted-foreground">
						{texts.instanceState}
					</Label>
					<NativeSelect
						id={FIELD_ID.INSTANCE_STATE}
						value={filter.instanceState ?? ANY_STATE}
						onChange={(event) => onApply({ ...filter, instanceState: deliveryInstanceStateOf(event.target.value) })}
					>
						<option value={ANY_STATE}>{texts.any}</option>
						{DELIVERY_INSTANCE_STATES.map((state) => (
							<option key={state} value={state}>
								{pacsStatusText(state)}
							</option>
						))}
					</NativeSelect>
				</div>
			</div>
		</search>
	)
}
